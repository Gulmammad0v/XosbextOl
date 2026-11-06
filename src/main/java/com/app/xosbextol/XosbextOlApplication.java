package com.app.xosbextol;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class XosbextOlApplication {

    public static void main(String[] args) {
        SpringApplication.run(XosbextOlApplication.class, args);
    }

}
