package com.app.xosbextol.model.dto;

import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import lombok.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.List;

@Data @NoArgsConstructor @AllArgsConstructor
public class BookingResponseDto {
    private long id;
    private String bookingNumber;
    private long hallId;
    private long userId;
    private String venueName;
    private String hallName;
    private String venuePhone;
    private LocalDate eventDate;
    private int guestCount;
    private BookingEventType eventType;
    private BookingStatus status;
    private BigDecimal hallPrice;
    private BigDecimal servicesPrice;
    private BigDecimal discountAmount;
    private BigDecimal totalPrice;
    private BigDecimal depositAmount;
    private BigDecimal paidAmount;
    private Instant expiresAt;
    private String customerNote;
    private Long menuPackageId;
    private String menuName;
    private BigDecimal menuCustomizationPrice;
    private List<String> removedMenuItems;
    private List<String> addedMenuItems;
    private List<MenuCategoryResponseDto> menuCategories;
    private List<BookingMenuChangeResponseDto> menuChanges;
    private String customerName;
    private String customerEmail;
    private String customerPhone;
    private List<BookingExtraServiceResponseDto> extraServices;
    private Instant createdAt;
    private String cancelReason;

    public long id() { return id; }
    public LocalDate eventDate() { return eventDate; }
    public BookingStatus status() { return status; }
    public BigDecimal totalPrice() { return totalPrice; }
    public BigDecimal paidAmount() { return paidAmount; }
}
