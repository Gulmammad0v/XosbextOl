package com.app.xosbextol.model.constant;

import java.util.List;
import java.util.Set;


public final class AzerbaijanCities {
    public static final List<String> VALUES = List.of(
            "Ağcabədi", "Ağdam", "Ağdaş", "Ağstafa", "Ağsu", "Ağdərə", "Astara",
            "Babək", "Bakı", "Balakən", "Beyləqan", "Bərdə", "Biləsuvar", "Cəbrayıl", "Cəlilabad", "Culfa", "Daşkəsən",
            "Dəliməmmədli", "Əsgəran", "Füzuli", "Gəncə", "Goranboy", "Göyçay", "Göygöl", "Göytəpə", "Hacıqabul",
            "Horadiz", "Xaçmaz", "Xankəndi", "Xınalıq", "Xızı", "Xocalı", "Xocavənd", "Xırdalan", "Xudat", "İmişli",
            "İsmayıllı", "Kəlbəcər", "Kürdəmir", "Laçın", "Lerik", "Lənkəran", "Liman", "Masallı", "Mingəçevir",
            "Naftalan", "Naxçıvan", "Neftçala", "Oğuz", "Ordubad", "Qax", "Qazax", "Qəbələ", "Qobustan", "Quba",
            "Qubadlı", "Qusar", "Qovlar", "Saatlı", "Sabirabad", "Salyan", "Samux", "Siyəzən", "Sumqayıt", "Şabran",
            "Şahbuz", "Şamaxı", "Şəki", "Şəmkir", "Şərur", "Şirvan", "Şuşa", "Tərtər", "Tovuz", "Ucar", "Yardımlı", "Yevlax",
            "Zaqatala", "Zəngilan", "Zərdab"
    );

    public static final String PATTERN = "Ağcabədi|Ağdam|Ağdaş|Ağstafa|Ağsu|Ağdərə|Astara|Babək|Bakı|Balakən|Beyləqan|Bərdə|Biləsuvar|Cəbrayıl|Cəlilabad|Culfa|Daşkəsən|Dəliməmmədli|Əsgəran|Füzuli|Gəncə|Goranboy|Göyçay|Göygöl|Göytəpə|Hacıqabul|Horadiz|Xaçmaz|Xankəndi|Xınalıq|Xızı|Xocalı|Xocavənd|Xırdalan|Xudat|İmişli|İsmayıllı|Kəlbəcər|Kürdəmir|Laçın|Lerik|Lənkəran|Liman|Masallı|Mingəçevir|Naftalan|Naxçıvan|Neftçala|Oğuz|Ordubad|Qax|Qazax|Qəbələ|Qobustan|Quba|Qubadlı|Qusar|Qovlar|Saatlı|Sabirabad|Salyan|Samux|Siyəzən|Sumqayıt|Şabran|Şahbuz|Şamaxı|Şəki|Şəmkir|Şərur|Şirvan|Şuşa|Tərtər|Tovuz|Ucar|Yardımlı|Yevlax|Zaqatala|Zəngilan|Zərdab";

    private static final Set<String> LOOKUP = Set.copyOf(VALUES);

    private AzerbaijanCities() {
    }

    public static boolean contains(String city) {
        return LOOKUP.contains(city);
    }
}
