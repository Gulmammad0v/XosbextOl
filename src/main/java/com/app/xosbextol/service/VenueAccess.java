package com.app.xosbextol.service;

import com.app.xosbextol.model.value.VenueHallSnapshot;

import com.app.xosbextol.model.value.VenueExtraSnapshot;
import java.time.*;
import java.util.*;
public interface VenueAccess {
    VenueHallSnapshot lockBookableHall(long hallId);
    VenueHallSnapshot lockHall(long hallId);
    VenueHallSnapshot hall(long hallId);
    boolean blocked(long hallId,LocalDate date);
    List<VenueExtraSnapshot> extras(long venueId,List<Long> ids);
    void assertOwner(long venueId,long userId);
    void assertEditable(long venueId,long userId);
    void assertRegistrationEditable(long venueId,long userId);
    void assertCompanyDocumentEditable(long venueId,long userId);
    void requestReapproval(long venueId,long userId);
    void updateRating(long venueId);
}
