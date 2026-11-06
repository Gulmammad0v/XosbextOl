package com.app.xosbextol.client.email;

import jakarta.mail.MessagingException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.mail.MailSendException;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;
import org.springframework.web.util.HtmlUtils;

import java.io.UnsupportedEncodingException;
import java.nio.charset.StandardCharsets;

@Component
public class BrandedEmailSender {
    private static final String LOGO_CID = "xosbextol-logo";
    private final JavaMailSender mail;
    private final String from;

    public BrandedEmailSender(JavaMailSender mail, @Value("${app.notification.email-from}") String from) {
        this.mail = mail;
        this.from = from;
    }

    public void send(String to, String subject, String text) {
        try {
            var message = mail.createMimeMessage();
            var helper = new MimeMessageHelper(message, true, StandardCharsets.UTF_8.name());
            helper.setFrom(from, "Xoşbəxt Ol");
            helper.setTo(to);
            helper.setSubject(subject);
            helper.setText(html(subject, text), true);
            helper.addInline(LOGO_CID, new ClassPathResource("email/brand-logo.png"), "image/png");
            mail.send(message);
        } catch (MessagingException | UnsupportedEncodingException ex) {
            throw new MailSendException("Email hazırlanmadı", ex);
        }
    }

    private String html(String subject, String text) {
        String safeSubject = HtmlUtils.htmlEscape(subject);
        String safeText = HtmlUtils.htmlEscape(text).replace("\n", "<br>");
        return """
                <!doctype html>
                <html lang="az"><body style="margin:0;background:#faf8f2;font-family:Arial,sans-serif;color:#2d2923">
                  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
                    <div style="background:#fffdf8;border:1px solid #e4dac7;border-radius:24px;padding:28px;text-align:center">
                      <img src="cid:%s" alt="Xoşbəxt Ol" style="width:180px;max-width:70%%;height:auto;margin:0 auto 20px">
                      <h1 style="font-size:24px;line-height:32px;margin:0 0 14px;color:#725526">%s</h1>
                      <p style="font-size:16px;line-height:25px;margin:0;color:#756d61">%s</p>
                    </div>
                    <p style="font-size:12px;line-height:18px;text-align:center;color:#918879;margin:18px 0 0">Xoşbəxt Ol</p>
                  </div>
                </body></html>
                """.formatted(LOGO_CID, safeSubject, safeText);
    }
}
