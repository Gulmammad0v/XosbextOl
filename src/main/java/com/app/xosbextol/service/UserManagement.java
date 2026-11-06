package com.app.xosbextol.service;
import java.util.Map;
public interface UserManagement {
    Map<String,Object> list(int page,int size);
    void change(long actor,long id,String role,String status);
}
