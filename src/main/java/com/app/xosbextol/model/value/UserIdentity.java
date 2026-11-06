package com.app.xosbextol.model.value;

import lombok.Value;
import lombok.experimental.Accessors;

@Value @Accessors(fluent = true)
public class UserIdentity {
    long id;
    String email;
    String role;
    String language;
}
