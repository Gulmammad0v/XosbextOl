package com.app.xosbextol.booking;
import com.app.xosbextol.service.impl.BookingStateMachine;
import com.app.xosbextol.model.enums.BookingStatus;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class BookingStateMachineTest {
    private final BookingStateMachine states=new BookingStateMachine();
    @Test void terminalStatusesCannotBeReconfirmed() {
        assertThrows(BusinessException.class,()->states.check(BookingStatus.CANCELLED,BookingStatus.CONFIRMED));
        assertThrows(BusinessException.class,()->states.check(BookingStatus.REJECTED,BookingStatus.CONFIRMED));
        assertThrows(BusinessException.class,()->states.check(BookingStatus.COMPLETED,BookingStatus.CANCELLED));
    }
    @Test void supportedLifecycle() {
        states.check(BookingStatus.PENDING_APPROVAL,BookingStatus.CONFIRMED);
        states.check(BookingStatus.PENDING_APPROVAL,BookingStatus.CANCELLED);
        states.check(BookingStatus.PENDING_APPROVAL,BookingStatus.REJECTED);
        states.check(BookingStatus.CONFIRMED,BookingStatus.CANCELLED);
        states.check(BookingStatus.CONFIRMED,BookingStatus.COMPLETED);
    }
}
