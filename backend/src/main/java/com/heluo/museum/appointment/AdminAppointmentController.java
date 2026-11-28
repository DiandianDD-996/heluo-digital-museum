package com.heluo.museum.appointment;

import com.heluo.museum.common.api.ApiResponse;
import com.heluo.museum.common.audit.OperationLogService;
import com.heluo.museum.common.error.ConflictException;
import com.heluo.museum.common.error.ContentPage;
import com.heluo.museum.common.error.ResourceNotFoundException;
import com.heluo.museum.common.notification.NotificationService;
import jakarta.transaction.Transactional;
import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminAppointmentController {
    private static final Set<String> VALID_SLOT_STATUSES = Set.of("OPEN", "CLOSED", "CANCELLED");
    private static final Set<String> VALID_APPOINTMENT_STATUSES = Set.of("PENDING", "CONFIRMED", "COMPLETED", "CANCELLED");
    private static final MediaType TEXT_CSV_UTF8 = MediaType.parseMediaType("text/csv; charset=UTF-8");
    private static final List<TimeWindowInput> DEFAULT_WINDOWS = List.of(
            new TimeWindowInput(LocalTime.of(9, 0), LocalTime.of(10, 30)),
            new TimeWindowInput(LocalTime.of(10, 30), LocalTime.of(12, 0)),
            new TimeWindowInput(LocalTime.of(13, 30), LocalTime.of(15, 0)),
            new TimeWindowInput(LocalTime.of(15, 15), LocalTime.of(16, 45))
    );

    private final JdbcTemplate jdbc;
    private final OperationLogService operationLogService;
    private final NotificationService notificationService;
    private final Clock clock;
    private final AppointmentVerification verification;

    AdminAppointmentController(JdbcTemplate jdbc, OperationLogService operationLogService, NotificationService notificationService,
                               Clock clock, AppointmentVerification verification) {
        this.jdbc = jdbc;
        this.operationLogService = operationLogService;
        this.notificationService = notificationService;
        this.clock = clock;
        this.verification = verification;
    }

    @GetMapping("/appointment-slots")
    public ApiResponse<ContentPage<SlotView>> listSlots(@RequestParam(defaultValue = "1") int page,
                                                        @RequestParam(defaultValue = "20") int size,
                                                        @RequestParam(required = false) LocalDate dateFrom,
                                                        @RequestParam(required = false) LocalDate dateTo,
                                                        @RequestParam(required = false) String status) {
        validateSlotPage(page, size);
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        String normalizedStatus = null;
        if (status != null && !status.isBlank()) {
            normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_SLOT_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("时段状态不合法");
            }
        }

        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> params = new ArrayList<>();
        if (dateFrom != null) {
            where.append(" and visit_date>=?");
            params.add(dateFrom);
        }
        if (dateTo != null) {
            where.append(" and visit_date<=?");
            params.add(dateTo);
        }
        if (normalizedStatus != null) {
            where.append(" and status=?");
            params.add(normalizedStatus);
        }

        long total = jdbc.queryForObject("select count(*) from appointment_slots" + where, Long.class, params.toArray());
        List<Object> queryParams = new ArrayList<>(params);
        queryParams.add(size);
        queryParams.add((page - 1) * size);
        List<SlotView> items = jdbc.query(
                "select id,visit_date,start_time,end_time,capacity,reserved_people,status from appointment_slots"
                        + where + " order by visit_date,start_time limit ? offset ?",
                (rs, rowNum) -> slotView(rs), queryParams.toArray());
        return ApiResponse.ok(ContentPage.of(items, page, size, total), "admin-appointment-slots");
    }

    @GetMapping("/appointment-slots/calendar")
    public ApiResponse<CalendarMonthView> slotsCalendar(@RequestParam String month) {
        YearMonth ym;
        try {
            ym = YearMonth.parse(month == null ? "" : month.trim());
        } catch (DateTimeParseException ex) {
            throw new IllegalArgumentException("月份格式必须为 YYYY-MM");
        }
        LocalDate startDate = ym.atDay(1);
        LocalDate endDate = ym.atEndOfMonth();
        List<SlotView> monthSlots = jdbc.query(
                "select id,visit_date,start_time,end_time,capacity,reserved_people,status from appointment_slots "
                        + "where visit_date between ? and ? order by visit_date,start_time",
                (rs, rowNum) -> slotView(rs), startDate, endDate);

        Map<LocalDate, List<SlotView>> byDate = new HashMap<>();
        for (SlotView slot : monthSlots) {
            byDate.computeIfAbsent(slot.visitDate(), k -> new ArrayList<>()).add(slot);
        }

        List<CalendarDaySummary> days = new ArrayList<>(ym.lengthOfMonth());
        int openDays = 0;
        int totalSlots = 0;
        int totalCapacity = 0;
        int totalReserved = 0;

        for (LocalDate d = startDate; !d.isAfter(endDate); d = d.plusDays(1)) {
            List<SlotView> daySlots = byDate.getOrDefault(d, List.of());
            int openCount = 0;
            int closedCount = 0;
            int dayCap = 0;
            int dayRes = 0;
            for (SlotView s : daySlots) {
                dayCap += s.capacity();
                dayRes += s.reservedPeople();
                if ("OPEN".equals(s.status())) {
                    openCount++;
                } else {
                    closedCount++;
                }
            }
            if (openCount > 0) {
                openDays++;
            }
            totalSlots += daySlots.size();
            totalCapacity += dayCap;
            totalReserved += dayRes;
            double rate = dayCap > 0 ? Math.round((dayRes * 1000.0) / dayCap) / 10.0 : 0.0;
            days.add(new CalendarDaySummary(
                    d,
                    d.getDayOfWeek() == DayOfWeek.MONDAY,
                    daySlots.size(),
                    openCount,
                    closedCount,
                    dayCap,
                    dayRes,
                    rate,
                    daySlots));
        }

        return ApiResponse.ok(new CalendarMonthView(
                ym.toString(),
                startDate,
                endDate,
                openDays,
                totalSlots,
                totalCapacity,
                totalReserved,
                days), "admin-slots-calendar");
    }

    @PostMapping("/appointment-slots")
    @Transactional
    public ApiResponse<SlotView> createSlot(Authentication authentication, @Valid @RequestBody SlotInput body) {
        validateTimes(body.visitDate(), body.startTime(), body.endTime());
        if (jdbc.queryForObject("select count(*) from appointment_slots where visit_date=? and start_time=? and end_time=?", Integer.class,
                body.visitDate(), body.startTime(), body.endTime()) > 0) {
            throw new ConflictException("该预约时段已存在");
        }
        long actorId = actorId(authentication);
        jdbc.update("insert into appointment_slots(visit_date,start_time,end_time,capacity,status,created_by,updated_by) values(?,?,?,?,?,?,?)",
                body.visitDate(), body.startTime(), body.endTime(), body.capacity(), body.status(), actorId, actorId);
        long id = jdbc.queryForObject("select id from appointment_slots where visit_date=? and start_time=? and end_time=?", Long.class,
                body.visitDate(), body.startTime(), body.endTime());
        operationLogService.record(actorId, "APPOINTMENT", "SLOT_CREATE", "APPOINTMENT_SLOT", String.valueOf(id));
        return ApiResponse.ok(slotById(id), "admin-slot-create");
    }

    @PatchMapping("/appointment-slots/{id}")
    @Transactional
    public ApiResponse<SlotView> updateSlot(Authentication authentication, @PathVariable long id, @Valid @RequestBody SlotInput body) {
        SlotView current = slotByIdForUpdate(id);
        validateTimes(body.visitDate(), body.startTime(), body.endTime());
        if (body.capacity() < current.reservedPeople()) {
            throw new ConflictException("容量不能小于已预约人数");
        }
        if ("CANCELLED".equals(body.status()) && current.reservedPeople() > 0) {
            throw new ConflictException("该时段已有观众预约，不能直接取消，请设为关闭或先处理对应预约");
        }
        Integer duplicate = jdbc.queryForObject(
                "select count(*) from appointment_slots where visit_date=? and start_time=? and end_time=? and id<>?",
                Integer.class, body.visitDate(), body.startTime(), body.endTime(), id);
        if (duplicate != null && duplicate > 0) {
            throw new ConflictException("该预约时段已存在");
        }
        long actorId = actorId(authentication);
        jdbc.update("update appointment_slots set visit_date=?,start_time=?,end_time=?,capacity=?,status=?,updated_by=? where id=?",
                body.visitDate(), body.startTime(), body.endTime(), body.capacity(), body.status(), actorId, id);
        operationLogService.record(actorId, "APPOINTMENT", "SLOT_UPDATE", "APPOINTMENT_SLOT", String.valueOf(id));
        return ApiResponse.ok(slotById(id), "admin-slot-update");
    }

    @PostMapping("/appointment-slots/batch-generate")
    @Transactional
    public ApiResponse<BatchGenerateResult> batchGenerateSlots(Authentication authentication,
                                                               @Valid @RequestBody BatchGenerateSlotsInput body) {
        LocalDateTime now = LocalDateTime.now(clock);
        LocalDate today = now.toLocalDate();
        LocalDate maxEnd = AppointmentController.openWindowEnd(today);
        if (body.dateFrom().isBefore(today)) {
            throw new IllegalArgumentException("开始日期不能早于今天");
        }
        if (body.dateTo().isBefore(body.dateFrom())) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        if (ChronoUnit.DAYS.between(body.dateFrom(), body.dateTo()) > 90) {
            throw new IllegalArgumentException("单次批量排班最多支持 90 天");
        }
        if (body.dateTo().isAfter(maxEnd)) {
            throw new IllegalArgumentException("排班结束日期不能超过未来 365 天开放窗口");
        }

        List<TimeWindowInput> windows = (body.windows() == null || body.windows().isEmpty())
                ? DEFAULT_WINDOWS
                : body.windows();
        if (windows.size() > 8) {
            throw new IllegalArgumentException("单日最多生成 8 个时段");
        }
        for (TimeWindowInput w : windows) {
            if (w.startTime() == null || w.endTime() == null || !w.endTime().isAfter(w.startTime())) {
                throw new IllegalArgumentException("每个时段的结束时间必须晚于开始时间");
            }
        }

        Set<String> existingKeys = new HashSet<>(jdbc.query(
                "select visit_date,start_time,end_time from appointment_slots where visit_date between ? and ?",
                (rs, rowNum) -> slotKey(rs.getDate(1).toLocalDate(), rs.getTime(2).toLocalTime(), rs.getTime(3).toLocalTime()),
                body.dateFrom(), body.dateTo()));

        long actorId = actorId(authentication);
        List<Object[]> batchRows = new ArrayList<>();
        int skippedExisting = 0;
        int skippedMondays = 0;
        int skippedPast = 0;

        for (LocalDate date = body.dateFrom(); !date.isAfter(body.dateTo()); date = date.plusDays(1)) {
            if (body.skipMondays() && date.getDayOfWeek() == DayOfWeek.MONDAY) {
                skippedMondays++;
                continue;
            }
            for (TimeWindowInput w : windows) {
                if (!LocalDateTime.of(date, w.startTime()).isAfter(now)) {
                    skippedPast++;
                    continue;
                }
                String key = slotKey(date, w.startTime(), w.endTime());
                if (existingKeys.contains(key)) {
                    skippedExisting++;
                    continue;
                }
                existingKeys.add(key);
                batchRows.add(new Object[] {date, w.startTime(), w.endTime(), body.capacity(), actorId, actorId});
            }
        }

        if (!batchRows.isEmpty()) {
            jdbc.batchUpdate(
                    "insert into appointment_slots(visit_date,start_time,end_time,capacity,status,created_by,updated_by) "
                            + "values(?,?,?,?, 'OPEN',?,?)",
                    batchRows);
        }
        operationLogService.record(actorId, "APPOINTMENT", "SLOT_BATCH_GENERATE", "APPOINTMENT_SLOT",
                body.dateFrom() + ".." + body.dateTo() + ":" + batchRows.size());
        return ApiResponse.ok(
                new BatchGenerateResult(batchRows.size(), skippedExisting, skippedMondays, skippedPast),
                "admin-slot-batch-generate");
    }

    @PostMapping("/appointment-slots/batch-status")
    @Transactional
    public ApiResponse<BatchStatusResult> batchUpdateSlotStatus(Authentication authentication,
                                                                @Valid @RequestBody BatchUpdateSlotsInput body) {
        if (body.dateTo().isBefore(body.dateFrom())) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        if (ChronoUnit.DAYS.between(body.dateFrom(), body.dateTo()) > 90) {
            throw new IllegalArgumentException("单次批量更新最多支持 90 天");
        }
        LocalDateTime now = LocalDateTime.now(clock);
        long actorId = actorId(authentication);

        List<SlotView> targets = jdbc.query(
                "select id,visit_date,start_time,end_time,capacity,reserved_people,status from appointment_slots "
                        + "where visit_date between ? and ? order by id for update",
                (rs, rowNum) -> slotView(rs), body.dateFrom(), body.dateTo());

        int updated = 0;
        int skippedPast = 0;
        int skippedCapacityConflict = 0;
        int affectedReserved = 0;

        for (SlotView slot : targets) {
            if (!LocalDateTime.of(slot.visitDate(), slot.startTime()).isAfter(now)) {
                skippedPast++;
                continue;
            }
            if (body.capacity() != null && body.capacity() < slot.reservedPeople()) {
                skippedCapacityConflict++;
                continue;
            }
            int nextCapacity = body.capacity() != null ? body.capacity() : slot.capacity();
            jdbc.update("update appointment_slots set status=?,capacity=?,updated_by=? where id=?",
                    body.status(), nextCapacity, actorId, slot.id());
            updated++;
            affectedReserved += slot.reservedPeople();
        }

        operationLogService.record(actorId, "APPOINTMENT", "SLOT_BATCH_STATUS", "APPOINTMENT_SLOT",
                body.dateFrom() + ".." + body.dateTo() + ":" + body.status() + ":" + updated);
        return ApiResponse.ok(
                new BatchStatusResult(updated, skippedPast, skippedCapacityConflict, affectedReserved),
                "admin-slot-batch-status");
    }

    @GetMapping("/appointments")
    public ApiResponse<ContentPage<AppointmentController.AppointmentView>> appointments(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LocalDate visitDate,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo) {
        validatePage(page, size);
        FilterCriteria filter = buildAppointmentFilter(status, keyword, visitDate, dateFrom, dateTo);
        long total = jdbc.queryForObject(
                "select count(*) from appointments a join appointment_slots s on s.id=a.slot_id" + filter.whereClause(),
                Long.class, filter.params().toArray());
        List<Object> args = new ArrayList<>(filter.params());
        args.add(size);
        args.add((page - 1) * size);
        List<AppointmentController.AppointmentView> items = jdbc.query(
                AppointmentController.selectAppointments() + filter.whereClause()
                        + " order by s.visit_date desc,s.start_time desc,a.id desc limit ? offset ?",
                (rs, rowNum) -> AppointmentController.view(rs, verification), args.toArray());
        return ApiResponse.ok(ContentPage.of(items, page, size, total), "admin-appointments");
    }

    @GetMapping("/appointments/lookup")
    public ApiResponse<AppointmentLookupView> lookupAppointment(@RequestParam String code) {
        String normalized = code == null ? "" : code.trim().toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException("请输入 10 位核验码或预约编号");
        }
        AppointmentController.AppointmentView found = findAppointmentByLookupCode(normalized);
        if (found == null) {
            throw new ResourceNotFoundException("未找到对应预约记录");
        }
        return ApiResponse.ok(toLookupView(found, LocalDateTime.now(clock)), "admin-appointment-lookup");
    }

    @PostMapping("/appointments/check-in-by-code")
    @Transactional
    public ApiResponse<AppointmentController.AppointmentView> checkInByCode(Authentication authentication,
                                                                            @Valid @RequestBody QuickCheckIn body) {
        String code = body.verificationCode().trim().toUpperCase(Locale.ROOT);
        AppointmentController.AppointmentView candidate = findAppointmentByVerificationCode(code, true);
        if (candidate == null) {
            candidate = findAppointmentByVerificationCode(code, false);
        }
        if (candidate == null) {
            throw new ResourceNotFoundException("未找到匹配该核验码的预约");
        }
        return ApiResponse.ok(
                performCheckIn(actorId(authentication), candidate.id(), code),
                "admin-appointment-check-in-by-code");
    }

    @GetMapping("/appointments/export")
    public ResponseEntity<byte[]> exportAppointmentsCsv(
            Authentication authentication,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) LocalDate visitDate,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo) {
        FilterCriteria filter = buildAppointmentFilter(status, keyword, visitDate, dateFrom, dateTo);
        List<Object> args = new ArrayList<>(filter.params());
        args.add(5000);
        List<AppointmentController.AppointmentView> rows = jdbc.query(
                AppointmentController.selectAppointments() + filter.whereClause()
                        + " order by s.visit_date asc,s.start_time asc,a.id asc limit ?",
                (rs, rowNum) -> AppointmentController.view(rs, verification), args.toArray());

        StringBuilder csv = new StringBuilder("\uFEFF");
        csv.append("预约编号,入馆日期,入馆时段,预约人数,状态,联系人,联系电话,联系邮箱,入馆核验码,备注,取消原因\r\n");
        for (AppointmentController.AppointmentView item : rows) {
            csv.append(csvCell(item.appointmentNo())).append(',')
                    .append(csvCell(String.valueOf(item.visitDate()))).append(',')
                    .append(csvCell(item.startTime() + "-" + item.endTime())).append(',')
                    .append(csvCell(String.valueOf(item.visitorCount()))).append(',')
                    .append(csvCell(appointmentStatusLabel(item.status()))).append(',')
                    .append(csvCell(item.contactName())).append(',')
                    .append(csvCell(item.contactPhone())).append(',')
                    .append(csvCell(item.contactEmail())).append(',')
                    .append(csvCell(item.verificationCode())).append(',')
                    .append(csvCell(item.notes())).append(',')
                    .append(csvCell(item.cancelReason())).append("\r\n");
        }

        String dateSuffix = visitDate != null
                ? visitDate.toString()
                : (dateFrom != null && dateTo != null ? dateFrom + "_to_" + dateTo : "all");
        String filename = "heluo-appointments-" + dateSuffix + ".csv";
        operationLogService.record(actorId(authentication), "APPOINTMENT", "EXPORT_CSV", "APPOINTMENT",
                dateSuffix + ":" + rows.size());

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(TEXT_CSV_UTF8);
        headers.setContentDisposition(ContentDisposition.attachment().filename(filename, StandardCharsets.UTF_8).build());
        headers.setCacheControl(CacheControl.noStore());
        return ResponseEntity.ok().headers(headers).body(csv.toString().getBytes(StandardCharsets.UTF_8));
    }

    @PostMapping("/appointments/{id}/confirm")
    @Transactional
    public ApiResponse<AppointmentController.AppointmentView> confirm(Authentication authentication, @PathVariable long id) {
        AppointmentController.AppointmentView appointment = appointmentAndSlotByIdForUpdate(id);
        if (!"PENDING".equals(appointment.status())) throw new ConflictException("只有待确认预约可以确认");
        int changed = jdbc.update("update appointments set status='CONFIRMED' where id=? and status='PENDING'", id);
        if (changed != 1) throw new ConflictException("预约状态已变化，请刷新后重试");
        operationLogService.record(actorId(authentication), "APPOINTMENT", "CONFIRM", "APPOINTMENT", String.valueOf(id));
        notificationService.sendStatusNotification(appointment.contactEmail(), "预约已确认", "您的线下参观预约已确认。");
        return ApiResponse.ok(appointmentById(id), "admin-appointment-confirm");
    }

    @PostMapping("/appointments/{id}/cancel")
    @Transactional
    public ApiResponse<AppointmentController.AppointmentView> cancel(Authentication authentication, @PathVariable long id,
                                                                       @Valid @RequestBody AdminCancel body) {
        AppointmentController.AppointmentView appointment = appointmentAndSlotByIdForUpdate(id);
        if (!"PENDING".equals(appointment.status()) && !"CONFIRMED".equals(appointment.status())) {
            throw new ConflictException("当前预约状态不可取消");
        }
        int changed = jdbc.update("update appointments set status='CANCELLED',cancel_reason=?,cancelled_at=current_timestamp(3) "
                        + "where id=? and status in ('PENDING','CONFIRMED')", body.reason().trim(), id);
        if (changed != 1) throw new ConflictException("预约状态已变化，请刷新后重试");
        jdbc.update("delete from appointment_active_keys where appointment_id=?", id);
        int released = jdbc.update("update appointment_slots set reserved_people=reserved_people-? where id=? and reserved_people>=?",
                appointment.visitorCount(), appointment.slotId(), appointment.visitorCount());
        if (released != 1) throw new ConflictException("预约名额状态异常，请先核查后重试");
        operationLogService.record(actorId(authentication), "APPOINTMENT", "ADMIN_CANCEL", "APPOINTMENT", String.valueOf(id));
        notificationService.sendStatusNotification(appointment.contactEmail(), "预约已取消", "您的线下参观预约已取消。");
        return ApiResponse.ok(appointmentById(id), "admin-appointment-cancel");
    }

    @PostMapping("/appointments/{id}/complete")
    @Transactional
    public ApiResponse<AppointmentController.AppointmentView> complete(Authentication authentication, @PathVariable long id) {
        AppointmentController.AppointmentView appointment = appointmentAndSlotByIdForUpdate(id);
        if (!"CONFIRMED".equals(appointment.status())) throw new ConflictException("只有已确认预约可以完成");
        if (LocalDateTime.of(appointment.visitDate(), appointment.endTime()).isAfter(LocalDateTime.now(clock))) {
            throw new ConflictException("参观时段尚未结束，不能标记完成");
        }
        int changed = jdbc.update("update appointments set status='COMPLETED',completed_at=current_timestamp(3) where id=? and status='CONFIRMED'", id);
        if (changed != 1) throw new ConflictException("预约状态已变化，请刷新后重试");
        jdbc.update("delete from appointment_active_keys where appointment_id=?", id);
        operationLogService.record(actorId(authentication), "APPOINTMENT", "COMPLETE", "APPOINTMENT", String.valueOf(id));
        return ApiResponse.ok(appointmentById(id), "admin-appointment-complete");
    }

    @PostMapping("/appointments/{id}/check-in")
    @Transactional
    public ApiResponse<AppointmentController.AppointmentView> checkIn(Authentication authentication, @PathVariable long id,
                                                                     @Valid @RequestBody CheckIn body) {
        return ApiResponse.ok(
                performCheckIn(actorId(authentication), id, body.verificationCode()),
                "admin-appointment-check-in");
    }

    private AppointmentController.AppointmentView performCheckIn(long actorId, long id, String suppliedCode) {
        var appointment = appointmentAndSlotByIdForUpdate(id);
        var now = LocalDateTime.now(clock);
        if (!"CONFIRMED".equals(appointment.status())) {
            throw new ConflictException("只有已确认预约可以核销");
        }
        if (now.isBefore(appointment.startAt()) || !now.isBefore(LocalDateTime.of(appointment.visitDate(), appointment.endTime()))) {
            throw new ConflictException("仅可在预约时段内核销");
        }
        if (!verification.matches(appointment.appointmentNo(), suppliedCode)) {
            throw new IllegalArgumentException("核销码不正确");
        }
        int changed = jdbc.update("update appointments set status='COMPLETED',completed_at=?,checked_in_at=? where id=? and status='CONFIRMED'",
                now, now, id);
        if (changed != 1) {
            throw new ConflictException("预约状态已变化，请刷新后重试");
        }
        jdbc.update("delete from appointment_active_keys where appointment_id=?", id);
        operationLogService.record(actorId, "APPOINTMENT", "CHECK_IN", "APPOINTMENT", String.valueOf(id));
        return appointmentById(id);
    }

    private AppointmentController.AppointmentView findAppointmentByLookupCode(String normalizedCode) {
        if (normalizedCode.matches("^AP[A-Z0-9]{6,32}$")) {
            List<AppointmentController.AppointmentView> direct = jdbc.query(
                    AppointmentController.selectAppointments() + " where upper(a.appointment_no)=?",
                    (rs, rowNum) -> AppointmentController.view(rs, verification), normalizedCode);
            return direct.isEmpty() ? null : direct.get(0);
        }
        if (normalizedCode.matches("^[0-9A-F]{10}$")) {
            LocalDate today = LocalDate.now(clock);
            List<AppointmentController.AppointmentView> windowCandidates = jdbc.query(
                    AppointmentController.selectAppointments()
                            + " where s.visit_date between ? and ? order by s.visit_date asc, s.start_time asc, a.id desc",
                    (rs, rowNum) -> AppointmentController.view(rs, verification),
                    today.minusDays(1), today.plusDays(365));
            for (AppointmentController.AppointmentView item : windowCandidates) {
                if (verification.matches(item.appointmentNo(), normalizedCode)) {
                    return item;
                }
            }
            List<AppointmentController.AppointmentView> recentCandidates = jdbc.query(
                    AppointmentController.selectAppointments() + " order by a.id desc limit 1000",
                    (rs, rowNum) -> AppointmentController.view(rs, verification));
            for (AppointmentController.AppointmentView item : recentCandidates) {
                if (verification.matches(item.appointmentNo(), normalizedCode)) {
                    return item;
                }
            }
            return null;
        }
        throw new IllegalArgumentException("请输入正确的 10 位核验码或预约编号（AP 开头）");
    }

    private AppointmentController.AppointmentView findAppointmentByVerificationCode(String code, boolean confirmedOnly) {
        String where = confirmedOnly ? " where a.status='CONFIRMED'" : " where a.status<>'CONFIRMED'";
        String tail = confirmedOnly ? " order by s.visit_date asc, s.start_time asc, a.id desc" : " order by a.id desc limit 1000";
        List<AppointmentController.AppointmentView> list = jdbc.query(
                AppointmentController.selectAppointments() + where + tail,
                (rs, rowNum) -> AppointmentController.view(rs, verification));
        for (AppointmentController.AppointmentView item : list) {
            if (verification.matches(item.appointmentNo(), code)) {
                return item;
            }
        }
        return null;
    }

    private AppointmentLookupView toLookupView(AppointmentController.AppointmentView appt, LocalDateTime now) {
        String status = appt.status();
        if ("COMPLETED".equals(status)) {
            return new AppointmentLookupView(appt, false, "该预约已完成入馆核销");
        }
        if ("CANCELLED".equals(status)) {
            return new AppointmentLookupView(appt, false, "该预约已取消，无法核销");
        }
        if ("PENDING".equals(status)) {
            return new AppointmentLookupView(appt, false, "该预约待确认，请先确认后再核销");
        }
        LocalDateTime endAt = LocalDateTime.of(appt.visitDate(), appt.endTime());
        if (now.isBefore(appt.startAt())) {
            return new AppointmentLookupView(appt, false,
                    "尚未到达入馆时段（" + appt.visitDate() + " " + appt.startTime() + " 开始）");
        }
        if (!now.isBefore(endAt)) {
            return new AppointmentLookupView(appt, false, "入馆时段已结束，请改用「标记完成」");
        }
        return new AppointmentLookupView(appt, true, "处于可核销时段，可立即入馆核销");
    }

    private FilterCriteria buildAppointmentFilter(String status, String keyword, LocalDate visitDate,
                                                  LocalDate dateFrom, LocalDate dateTo) {
        if (dateFrom != null && dateTo != null && dateTo.isBefore(dateFrom)) {
            throw new IllegalArgumentException("结束日期不能早于开始日期");
        }
        StringBuilder where = new StringBuilder(" where 1=1");
        List<Object> params = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            String normalizedStatus = status.trim().toUpperCase(Locale.ROOT);
            if (!VALID_APPOINTMENT_STATUSES.contains(normalizedStatus)) {
                throw new IllegalArgumentException("预约状态不合法");
            }
            where.append(" and a.status=?");
            params.add(normalizedStatus);
        }
        if (visitDate != null) {
            where.append(" and s.visit_date=?");
            params.add(visitDate);
        } else {
            if (dateFrom != null) {
                where.append(" and s.visit_date>=?");
                params.add(dateFrom);
            }
            if (dateTo != null) {
                where.append(" and s.visit_date<=?");
                params.add(dateTo);
            }
        }
        if (keyword != null && !keyword.isBlank()) {
            String escaped = escapeLike(keyword.trim().toLowerCase(Locale.ROOT));
            String pattern = "%" + escaped + "%";
            where.append(" and (lower(a.appointment_no) like ? escape '\\'"
                    + " or lower(a.contact_name) like ? escape '\\'"
                    + " or lower(a.contact_phone) like ? escape '\\'"
                    + " or lower(a.contact_email) like ? escape '\\')");
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
            params.add(pattern);
        }
        return new FilterCriteria(where.toString(), params);
    }

    private static String escapeLike(String raw) {
        return raw.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static String csvCell(String raw) {
        String value = raw == null ? "" : raw;
        String trimmed = value.stripLeading();
        if (!trimmed.isEmpty()) {
            char first = trimmed.charAt(0);
            if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
                value = "'" + value;
            }
        }
        return "\"" + value.replace("\"", "\"\"") + "\"";
    }

    private static String appointmentStatusLabel(String status) {
        return switch (status) {
            case "PENDING" -> "待确认";
            case "CONFIRMED" -> "已确认";
            case "COMPLETED" -> "已完成";
            case "CANCELLED" -> "已取消";
            default -> status;
        };
    }

    private static String slotKey(LocalDate date, LocalTime start, LocalTime end) {
        return date + "|" + start + "|" + end;
    }

    private AppointmentController.AppointmentView appointmentById(long id) {
        List<AppointmentController.AppointmentView> items = jdbc.query(AppointmentController.selectAppointments() + " where a.id=?",
                (rs, rowNum) -> AppointmentController.view(rs, verification), id);
        if (items.isEmpty()) throw new ResourceNotFoundException("预约不存在");
        return items.get(0);
    }

    /**
     * Reservation creation locks its slot before any appointment row. All state
     * transitions follow that same order so a create/cancel/confirm race cannot
     * revive an appointment after its active key or capacity was released.
     */
    private AppointmentController.AppointmentView appointmentAndSlotByIdForUpdate(long id) {
        List<Long> slotIds = jdbc.query("select slot_id from appointments where id=?", (rs, rowNum) -> rs.getLong(1), id);
        if (slotIds.isEmpty()) throw new ResourceNotFoundException("预约不存在");
        slotByIdForUpdate(slotIds.get(0));
        return appointmentByIdForUpdate(id);
    }

    private AppointmentController.AppointmentView appointmentByIdForUpdate(long id) {
        List<AppointmentController.AppointmentView> items = jdbc.query(AppointmentController.selectAppointments() + " where a.id=? for update",
                (rs, rowNum) -> AppointmentController.view(rs, verification), id);
        if (items.isEmpty()) throw new ResourceNotFoundException("预约不存在");
        return items.get(0);
    }

    private SlotView slotById(long id) {
        List<SlotView> slots = jdbc.query("select id,visit_date,start_time,end_time,capacity,reserved_people,status from appointment_slots where id=?",
                (rs, rowNum) -> slotView(rs), id);
        if (slots.isEmpty()) throw new ResourceNotFoundException("预约时段不存在");
        return slots.get(0);
    }

    private SlotView slotByIdForUpdate(long id) {
        List<SlotView> slots = jdbc.query("select id,visit_date,start_time,end_time,capacity,reserved_people,status from appointment_slots where id=? for update",
                (rs, rowNum) -> slotView(rs), id);
        if (slots.isEmpty()) throw new ResourceNotFoundException("预约时段不存在");
        return slots.get(0);
    }

    private static SlotView slotView(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new SlotView(rs.getLong("id"), rs.getDate("visit_date").toLocalDate(), rs.getTime("start_time").toLocalTime(),
                rs.getTime("end_time").toLocalTime(), rs.getInt("capacity"), rs.getInt("reserved_people"), rs.getString("status"));
    }

    private void validateTimes(LocalDate date, LocalTime start, LocalTime end) {
        if (!LocalDateTime.of(date, start).isAfter(LocalDateTime.now(clock)) || !end.isAfter(start)) {
            throw new IllegalArgumentException("预约时段必须在未来，且结束时间晚于开始时间");
        }
    }

    private static void validateSlotPage(int page, int size) {
        if (page < 1 || size < 1 || size > 200) {
            throw new IllegalArgumentException("page 必须大于 0，size 必须在 1 到 200 之间");
        }
    }

    private static void validatePage(int page, int size) {
        if (page < 1 || size < 1 || size > 100) {
            throw new IllegalArgumentException("page 必须大于 0，size 必须在 1 到 100 之间");
        }
    }

    private static long actorId(Authentication authentication) {
        return (Long) authentication.getPrincipal();
    }

    private record FilterCriteria(String whereClause, List<Object> params) {}

    public record SlotView(long id, LocalDate visitDate, LocalTime startTime, LocalTime endTime, int capacity, int reservedPeople, String status) {}
    public record SlotInput(@NotNull @FutureOrPresent LocalDate visitDate, @NotNull LocalTime startTime, @NotNull LocalTime endTime,
                            @Min(1) @Max(500) int capacity, @NotBlank @Pattern(regexp = "OPEN|CLOSED|CANCELLED") String status) {}
    public record TimeWindowInput(@NotNull LocalTime startTime, @NotNull LocalTime endTime) {}
    public record BatchGenerateSlotsInput(@NotNull LocalDate dateFrom, @NotNull LocalDate dateTo, boolean skipMondays,
                                          @Min(1) @Max(500) int capacity, List<TimeWindowInput> windows) {}
    public record BatchGenerateResult(int createdCount, int skippedExistingCount, int skippedMondayCount, int skippedPastCount) {}
    public record BatchUpdateSlotsInput(@NotNull LocalDate dateFrom, @NotNull LocalDate dateTo,
                                        @NotBlank @Pattern(regexp = "OPEN|CLOSED") String status, @Min(1) @Max(500) Integer capacity) {}
    public record BatchStatusResult(int updatedCount, int skippedPastCount, int skippedCapacityConflictCount, int affectedReservedPeople) {}
    public record CalendarDaySummary(LocalDate visitDate, boolean isMonday, int slotCount, int openSlotCount, int closedSlotCount,
                                     int totalCapacity, int reservedPeople, double utilizationRate, List<SlotView> slots) {}
    public record CalendarMonthView(String month, LocalDate startDate, LocalDate endDate, int openDays, int totalSlots,
                                    int totalCapacity, int totalReserved, List<CalendarDaySummary> days) {}
    public record AppointmentLookupView(AppointmentController.AppointmentView appointment, boolean canCheckInNow, String checkInHint) {}
    public record QuickCheckIn(@NotBlank @Pattern(regexp = "[0-9A-Fa-f]{10}") String verificationCode) {}
    public record AdminCancel(@NotBlank @Size(max = 255) String reason) {}
    public record CheckIn(@NotBlank @Pattern(regexp = "[0-9A-Fa-f]{10}") String verificationCode) {}
}
