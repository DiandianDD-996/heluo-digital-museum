package com.heluo.museum.common.notification;

import static org.assertj.core.api.Assertions.assertThatIllegalStateException;
import org.junit.jupiter.api.Test;
import org.springframework.mock.env.MockEnvironment;

class SmtpSafetyCheckTests {
    @Test void onlyLocalOrDevelopmentDeploymentCanUseTestSmtp() {
        var prod = new MockEnvironment();
        assertThatIllegalStateException().isThrownBy(() -> new SmtpSafetyCheck(prod, "https://museum.example", "Mailpit.", 587));
        assertThatIllegalStateException().isThrownBy(() -> new SmtpSafetyCheck(prod, "https://museum.example", "smtp.example", 1025));
        new SmtpSafetyCheck(prod, "https://museum.example", "", 1025);
        new SmtpSafetyCheck(prod, "https://museum.example", "smtp.example", 587);
        new SmtpSafetyCheck(prod, "http://[::1]:8088", "mailpit", 1025);
        new SmtpSafetyCheck(new MockEnvironment().withProperty("spring.profiles.active", "dev"),
                "https://museum.example", "mailpit", 1025);
    }
}
