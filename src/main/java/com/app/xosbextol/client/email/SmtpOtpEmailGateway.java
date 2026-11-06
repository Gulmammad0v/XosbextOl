package com.app.xosbextol.client.email;

import org.springframework.stereotype.Component;
import org.springframework.http.HttpStatus;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import lombok.extern.log4j.Log4j2;

@Component
@Log4j2
public class SmtpOtpEmailGateway implements OtpEmailGateway {
    private final BrandedEmailSender mail;

    public SmtpOtpEmailGateway(BrandedEmailSender mail) {
        this.mail = mail;
    }

    @Override
    public void sendCode(String email, String code, long ttlSeconds) {
        try {
            mail.send(email, "Xoşbəxt Ol — email təsdiq kodu", "Email təsdiq kodunuz: " + code + "\nKod " + ttlSeconds + " saniyə ərzində etibarlıdır.");
        } catch (org.springframework.mail.MailException ex) {
            log.warn("OTP email delivery failed", ex);
            throw new BusinessException(HttpStatus.SERVICE_UNAVAILABLE, "Təsdiq emaili göndərilmədi. Bir qədər sonra yenidən sınayın.");
        }
    }
}
