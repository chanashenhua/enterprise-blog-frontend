<script setup lang="ts">
import { onMounted, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import {
  ArrowUpRight,
  Bell,
  Check,
  CheckCheck,
  Inbox,
  MessageSquareReply,
  Rss,
  ShieldCheck,
} from "lucide-vue-next";
import { api, type UserNotification } from "@/api/client";
import { useNotificationState } from "@/composables/notificationState";
import { useUserContext } from "@/composables/userContext";

const { userId } = useUserContext();
const { unreadCount, refreshUnreadCount } = useNotificationState();
const notifications = ref<UserNotification[]>([]);
const loading = ref(true);
const busyId = ref("");
const error = ref("");

async function loadNotifications() {
  loading.value = true;
  error.value = "";
  try {
    notifications.value = await api.listNotifications(userId.value);
    await refreshUnreadCount(userId.value);
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "通知加载失败";
  } finally {
    loading.value = false;
  }
}

async function markRead(notification: UserNotification) {
  if (notification.read || busyId.value) return;
  busyId.value = notification.id;
  try {
    const updated = await api.markNotificationRead(userId.value, notification.id);
    notifications.value = notifications.value.map((item) => item.id === updated.id ? updated : item);
    unreadCount.value = Math.max(0, unreadCount.value - 1);
  } finally {
    busyId.value = "";
  }
}

async function markAllRead() {
  if (!unreadCount.value) return;
  busyId.value = "all";
  try {
    const response = await api.markAllNotificationsRead(userId.value);
    notifications.value = notifications.value.map((item) => ({ ...item, read: true }));
    unreadCount.value = response.count;
  } finally {
    busyId.value = "";
  }
}

function notificationIcon(type: string) {
  if (type === "COMMENT_REPLY") return MessageSquareReply;
  if (type === "SUBSCRIPTION_ARTICLE_PUBLISHED") return Rss;
  return ShieldCheck;
}

function resourceLink(notification: UserNotification) {
  return notification.resourceType === "ARTICLE" && notification.resourceId
    ? `/articles/${notification.resourceId}`
    : null;
}

onMounted(loadNotifications);
watch(userId, loadNotifications);
</script>

<template>
  <section class="notifications-view">
    <header class="view-header">
      <div>
        <p class="eyebrow"><Bell :size="14" /> 消息中心</p>
        <h1>站内通知</h1>
        <p class="view-description">审核结果、评论回复和订阅更新会在这里集中呈现。</p>
      </div>
      <button class="button secondary" type="button" :disabled="!unreadCount || Boolean(busyId)" @click="markAllRead">
        <CheckCheck :size="17" /> 全部标为已读
      </button>
    </header>

    <p v-if="error" class="error-message">{{ error }}</p>
    <p v-else-if="loading" class="muted">正在加载通知...</p>

    <div v-else-if="notifications.length" class="notification-list">
      <article
        v-for="notification in notifications"
        :key="notification.id"
        class="notification-card"
        :class="{ unread: !notification.read }"
      >
        <span class="notification-type-icon">
          <component :is="notificationIcon(notification.type)" :size="19" />
        </span>
        <div class="notification-main">
          <div class="notification-heading">
            <h2>{{ notification.title }}</h2>
            <span>{{ new Date(notification.createdAt).toLocaleString("zh-CN") }}</span>
          </div>
          <p>{{ notification.content }}</p>
          <div class="notification-actions">
            <button
              v-if="!notification.read"
              class="text-action"
              type="button"
              :disabled="Boolean(busyId)"
              @click="markRead(notification)"
            >
              <Check :size="14" /> 标为已读
            </button>
            <RouterLink v-if="resourceLink(notification)" class="text-action" :to="resourceLink(notification) || '/notifications'">
              查看相关文章 <ArrowUpRight :size="14" />
            </RouterLink>
          </div>
        </div>
      </article>
    </div>

    <div v-else class="empty-state">
      <Inbox :size="28" />
      <h2>暂时没有通知</h2>
      <p>审核结果、评论回复和订阅更新到来后，会出现在这里。</p>
    </div>
  </section>
</template>
