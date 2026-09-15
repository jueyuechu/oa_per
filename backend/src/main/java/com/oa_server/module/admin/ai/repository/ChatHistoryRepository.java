package com.oa_server.module.admin.ai.repository;

import java.util.List;

public interface ChatHistoryRepository {
    /*
    * 保存会话记录
    * @param type
    * @param chatId
    * */
    void save(String type, String chatId);

    /*
    * 获取会话记录
    * @param type
    * @return
    * */
    List<String> getChatids(String type);
}
