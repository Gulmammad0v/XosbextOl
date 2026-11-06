package com.app.xosbextol.mapper;

import com.app.xosbextol.model.entity.User;
import com.app.xosbextol.model.dto.UserProfileResponseDto;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingConstants;

@Mapper(componentModel = MappingConstants.ComponentModel.SPRING)
public interface UserMapper {
    @Mapping(target = "id", source = "id", defaultValue = "0L")
    @Mapping(target = "role", expression = "java(user.getRole() == null ? null : user.getRole().name())")
    @Mapping(target = "language", source = "preferredLang")
    @Mapping(target = "hasPassword", expression = "java(user.getPasswordHash() != null)")
    UserProfileResponseDto profile(User user);
}
