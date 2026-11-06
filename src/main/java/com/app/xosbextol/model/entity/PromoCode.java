package com.app.xosbextol.model.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "promo_codes")
@org.hibernate.annotations.Check(constraints = "discount_value >= 0 and used_count >= 0 and (max_uses is null or max_uses > 0) and discount_type in ('PERCENT', 'FIXED') and (discount_type <> 'PERCENT' or discount_value <= 100)")
@Getter @Setter @NoArgsConstructor
public class PromoCode {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(nullable = false, unique = true, length = 40) private String code;
    @Column(nullable = false, length = 10) private String discountType;
    @Column(nullable = false, precision = 12, scale = 2) private BigDecimal discountValue;
    private Integer maxUses;
    private Integer usedCount = 0;
    private Instant validFrom;
    private Instant validTo;
    private Boolean active = true;
}
