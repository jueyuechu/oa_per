package com.oa_server.config;

import com.oa_server.constans.SystemConstans;
import com.oa_server.tools.SearchTools;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.client.advisor.MessageChatMemoryAdvisor;
import org.springframework.ai.chat.client.advisor.SimpleLoggerAdvisor;
import org.springframework.ai.chat.memory.MessageWindowChatMemory;
import org.springframework.ai.deepseek.DeepSeekChatModel;
import org.springframework.ai.openai.OpenAiEmbeddingModel;
import org.springframework.ai.vectorstore.SimpleVectorStore;
import org.springframework.ai.vectorstore.VectorStore;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class CommonConfiguration {

    @Bean
    public MessageWindowChatMemory messageWindowChatMemory() {
       return MessageWindowChatMemory
               .builder()
               .maxMessages(5)
               .build();
    }


    @Bean
    public ChatClient serviceChatClient(DeepSeekChatModel model, MessageWindowChatMemory chatMemory, SearchTools searchTools) {

        return ChatClient
                .builder(model)
                .defaultSystem(SystemConstans.SERVICE_SYSTEM_PROMPT)
                .defaultAdvisors(
                        new SimpleLoggerAdvisor(),
                        MessageChatMemoryAdvisor.builder(chatMemory).build()
                )
                .defaultTools(searchTools)
                .build();
    }

    @Bean
    public VectorStore vectorStore(OpenAiEmbeddingModel embeddingModel) {
        return SimpleVectorStore.builder(embeddingModel).build();
    }
}
