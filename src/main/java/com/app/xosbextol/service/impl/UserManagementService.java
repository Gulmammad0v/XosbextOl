package com.app.xosbextol.service.impl;

import com.app.xosbextol.service.UserManagement;
import com.app.xosbextol.model.entity.*;
import com.app.xosbextol.model.enums.*;
import com.app.xosbextol.model.dto.AdminUserResponseDto;
import com.app.xosbextol.repository.RefreshTokenRepository;
import com.app.xosbextol.repository.UserRepository;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import java.util.*;
@Service @RequiredArgsConstructor
public class UserManagementService implements UserManagement {
    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final AuditService audit;
    public Map<String,Object> list(int page,int size) {
        if(page<0 || size<1 || size>100) throw BusinessException.invalid("Səhifə ölçüsü 1–100 olmalıdır");
        var result=users.findAll(PageRequest.of(page,size,Sort.by("id")));
        var content=result.getContent().stream().map(u->new AdminUserResponseDto(u.getId(),u.getEmail(),u.getFullName(),u.getRole().name(),u.getStatus().name(),u.getCreatedAt())).toList();
        return Map.of("content",content,"page",page,"size",size,"totalElements",result.getTotalElements());
    }
    @Transactional public void change(long actor,long id,String role,String status) {
        var u=users.findById(id).orElseThrow(()->BusinessException.missing("İstifadəçi"));
        if(actor==id && (role!=null && !"ADMIN".equals(role) || status!=null && !"ACTIVE".equals(status))) throw BusinessException.conflict("Öz admin girişinizi ləğv edə bilməzsiniz");
        if(role!=null) u.setRole(Role.valueOf(role)); if(status!=null) u.setStatus(UserStatus.valueOf(status));
        refreshTokens.revokeAll(id);
        audit.record(actor,"USER_UPDATED","USER",id);
    }
}
