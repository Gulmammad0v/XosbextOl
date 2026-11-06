package com.app.xosbextol.scheduler;
import com.app.xosbextol.service.impl.ReminderService;
import com.app.xosbextol.service.BookingReminders;
import lombok.extern.log4j.Log4j2;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import lombok.RequiredArgsConstructor;
@Component @RequiredArgsConstructor @Log4j2
@org.springframework.boot.autoconfigure.condition.ConditionalOnProperty(name="app.scheduling.enabled",havingValue="true",matchIfMissing=true)
public class ReminderScheduler {
    private final BookingReminders bookings;
    private final ReminderService service;
    @Scheduled(fixedDelay=3600000,initialDelay=60000) public void run() {
        var reminders = bookings.due();
        if (!reminders.isEmpty()) log.info("Queueing booking reminders count={}", reminders.size());
        for (var reminder : reminders) service.enqueue(reminder);
    }
}
