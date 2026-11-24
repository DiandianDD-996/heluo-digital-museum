package com.heluo.museum.appointment;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
final class AppointmentVerification {
    private final SecretKeySpec key;

    AppointmentVerification(@Value("${museum.security.jwt-secret}") String secret) {
        this.key = new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    String code(String appointmentNo) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(key);
            return HexFormat.of().withUpperCase().formatHex(
                    mac.doFinal(("heluo:appointment-check-in:v1:" + appointmentNo)
                            .getBytes(StandardCharsets.UTF_8)), 0, 5);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("无法生成预约凭证", ex);
        }
    }

    boolean matches(String appointmentNo, String supplied) {
        return MessageDigest.isEqual(code(appointmentNo).getBytes(StandardCharsets.US_ASCII),
                supplied.toUpperCase(java.util.Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }
}
