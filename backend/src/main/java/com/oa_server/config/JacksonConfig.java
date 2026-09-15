package com.oa_server.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import tools.jackson.databind.module.SimpleModule;
import tools.jackson.databind.ser.std.ToStringSerializer;

/**
 * Jackson 序列化配置（Jackson 3）
 * 解决 JavaScript 大数字精度丢失问题：Long 类型统一转成 String
 *
 * @author Alu
 * @date 2026-09-11
 */
@Configuration
public class JacksonConfig {

    /**
     * 通过 JsonMapperBuilderCustomizer 定制 Spring Boot 4 自动配置的 Jackson 3 ObjectMapper
     */
    @Bean
    public JsonMapperBuilderCustomizer longToStringCustomizer() {
        return builder -> {
            // Long 和 long 统一序列化为字符串，防止前端 JS 精度丢失
            SimpleModule module = new SimpleModule();
            module.addSerializer(Long.class, ToStringSerializer.instance);
            module.addSerializer(Long.TYPE, ToStringSerializer.instance);
            builder.addModule(module);
        };
    }
}
