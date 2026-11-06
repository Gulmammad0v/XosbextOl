package com.app.xosbextol.model.dto;

import com.app.xosbextol.model.enums.BookingEventType;
import jakarta.validation.constraints.*;
import lombok.*;
import java.time.LocalDate;
import java.util.List;

@Data @NoArgsConstructor
public class CreateBookingRequestDto {
    @Positive private long hallId;
    @NotNull @Future private LocalDate eventDate;
    @Min(1) private int guestCount;
    @NotNull private BookingEventType eventType;
    @NotNull @Size(max = 30) private List<@Positive Long> extraServiceIds;
    @Size(max = 40) private String promoCode;
    @Size(max = 1000) private String customerNote;
    @Positive private Long menuPackageId;
    @Size(max = 100) private List<@Positive Long> removedMenuItemIds;
    @Size(max = 100) private List<@Positive Long> addedMenuItemIds;

    public CreateBookingRequestDto(long hallId, LocalDate eventDate, int guestCount, List<Long> extraServiceIds,
                                   String promoCode, String customerNote) {
        this(hallId, eventDate, guestCount, BookingEventType.WEDDING, extraServiceIds, promoCode, customerNote, null, List.of(), List.of());
    }

    public CreateBookingRequestDto(long hallId, LocalDate eventDate, int guestCount, List<Long> extraServiceIds,
                                   String promoCode, String customerNote, Long menuPackageId,
                                   List<Long> removedMenuItemIds, List<Long> addedMenuItemIds) {
        this(hallId, eventDate, guestCount, BookingEventType.WEDDING, extraServiceIds, promoCode, customerNote,
                menuPackageId, removedMenuItemIds, addedMenuItemIds);
    }

    public CreateBookingRequestDto(long hallId, LocalDate eventDate, int guestCount, BookingEventType eventType,
                                   List<Long> extraServiceIds, String promoCode, String customerNote, Long menuPackageId,
                                   List<Long> removedMenuItemIds, List<Long> addedMenuItemIds) {
        this.hallId = hallId;
        this.eventDate = eventDate;
        this.guestCount = guestCount;
        this.eventType = eventType;
        this.extraServiceIds = extraServiceIds;
        this.promoCode = promoCode;
        this.customerNote = customerNote;
        this.menuPackageId = menuPackageId;
        this.removedMenuItemIds = removedMenuItemIds;
        this.addedMenuItemIds = addedMenuItemIds;
    }
}
