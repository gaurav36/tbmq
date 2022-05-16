/**
 * Copyright © 2016-2020 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.thingsboard.mqtt.broker.server;

import io.netty.bootstrap.ServerBootstrap;
import io.netty.channel.Channel;
import io.netty.channel.EventLoopGroup;
import io.netty.channel.nio.NioEventLoopGroup;
import io.netty.channel.socket.nio.NioServerSocketChannel;
import io.netty.util.ResourceLeakDetector;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Service;

import javax.annotation.PreDestroy;

@Service
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(prefix = "listener.ssl", value = "enabled", havingValue = "true", matchIfMissing = false)
public class MqttSslServerBootstrap {
    @Value("${listener.ssl.bind_address}")
    private String host;
    @Value("${listener.ssl.bind_port}")
    private Integer port;

    @Value("${listener.ssl.netty.leak_detector_level}")
    private String leakDetectorLevel;
    @Value("${listener.ssl.netty.boss_group_thread_count}")
    private Integer bossGroupThreadCount;
    @Value("${listener.ssl.netty.worker_group_thread_count}")
    private Integer workerGroupThreadCount;

    private final MqttSslChannelInitializer mqttSslChannelInitializer;

    private Channel serverChannel;
    private EventLoopGroup bossGroup;
    private EventLoopGroup workerGroup;

    @EventListener(ApplicationReadyEvent.class)
    @Order(value = 101)
    public void onApplicationEvent(ApplicationReadyEvent applicationReadyEvent) throws Exception {
        log.info("[SSL Server] Setting resource leak detector level to {}", leakDetectorLevel);
        ResourceLeakDetector.setLevel(ResourceLeakDetector.Level.valueOf(leakDetectorLevel.toUpperCase()));

        log.info("[SSL Server] Starting MQTT server...");
        bossGroup = new NioEventLoopGroup(bossGroupThreadCount);
        workerGroup = new NioEventLoopGroup(workerGroupThreadCount);
        ServerBootstrap b = new ServerBootstrap();
        b.group(bossGroup, workerGroup)
                .channel(NioServerSocketChannel.class)
                .childHandler(mqttSslChannelInitializer)
        ;

        serverChannel = b.bind(host, port).sync().channel();
        log.info("[SSL Server] Mqtt server started!");
    }

    @PreDestroy
    public void shutdown() throws InterruptedException {
        log.info("[SSL Server] Stopping MQTT server!");
        try {
            if (serverChannel != null) {
                serverChannel.close().sync();
            }
        } finally {
            if (workerGroup != null) {
                workerGroup.shutdownGracefully();
            }
            if (bossGroup != null) {
                bossGroup.shutdownGracefully();
            }
        }
        log.info("[SSL Server] MQTT server stopped!");
    }
}
