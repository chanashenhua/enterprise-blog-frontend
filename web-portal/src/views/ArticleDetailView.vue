<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  ArrowLeft,
  Bookmark,
  Clock3,
  Eye,
  FilePenLine,
  FolderOpen,
  Heart,
  History,
  MessageCircle,
  Pencil,
  Reply,
  RotateCcw,
  Send,
  Tag,
  Trash2,
  UserRound,
  X,
} from "lucide-vue-next";
import { api, type Article, type ArticleComment, type ArticleContentVersion, type ArticleInteraction } from "@/api/client";
import { articleStatusLabels, canEditArticle, canWithdrawArticle } from "@/articlePresentation";
import { canManageComment, commentPlaceholder, groupCommentThreads, visibleCommentCount } from "@/commentPresentation";
import { useUserContext } from "@/composables/userContext";

const props = defineProps<{ id: string }>();
const router = useRouter();
const { userId } = useUserContext();
const article = ref<Article>();
const versions = ref<ArticleContentVersion[]>([]);
const interaction = ref<ArticleInteraction>();
const comments = ref<ArticleComment[]>([]);
const versionsVisible = ref(false);
const busy = ref(false);
const interactionBusy = ref(false);
const commentsLoading = ref(false);
const commentActionId = ref("");
const error = ref("");
const message = ref("");
const interactionMessage = ref("");
const commentError = ref("");
const commentMessage = ref("");
const newCommentContent = ref("");
const replyingTo = ref("");
const replyContent = ref("");
const editingCommentId = ref("");
const editContent = ref("");
const canManage = computed(() => article.value?.authorId === userId.value || userId.value === "u-admin");
const commentThreads = computed(() => groupCommentThreads(comments.value));
const commentCount = computed(() => visibleCommentCount(comments.value));

const authorLabels: Record<string, string> = {
  "u-admin": "平台管理员",
  "u-author": "技术作者",
  "u-reader": "普通读者",
};

function displayAuthor(authorId: string): string {
  return authorLabels[authorId] ?? authorId;
}

function authorInitial(authorId: string): string {
  return displayAuthor(authorId).slice(0, 1).toUpperCase();
}

function formatCommentTime(value: string): string {
  return new Date(value).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function loadComments(articleId: string) {
  commentsLoading.value = true;
  commentError.value = "";
  try {
    comments.value = await api.listArticleComments(userId.value, articleId);
  } catch (reason) {
    comments.value = [];
    commentError.value = reason instanceof Error ? reason.message : "评论加载失败";
  } finally {
    commentsLoading.value = false;
  }
}

async function loadArticle() {
  error.value = "";
  article.value = undefined;
  interaction.value = undefined;
  comments.value = [];
  versions.value = [];
  versionsVisible.value = false;
  interactionMessage.value = "";
  commentError.value = "";
  commentMessage.value = "";
  replyingTo.value = "";
  editingCommentId.value = "";
  try {
    const loaded = await api.getArticle(userId.value, props.id);
    article.value = loaded;
    if (loaded.status === "PUBLISHED") {
      await Promise.all([
        api.recordArticleView(userId.value, loaded.id)
          .then((result) => { interaction.value = result; })
          .catch((reason: unknown) => {
            interactionMessage.value = reason instanceof Error ? reason.message : "互动数据暂时不可用";
          }),
        loadComments(loaded.id),
      ]);
    }
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : "文章加载失败";
  }
}

async function createComment() {
  if (!article.value || commentActionId.value) return;
  const content = newCommentContent.value.trim();
  if (!content) {
    commentError.value = "请输入评论内容";
    return;
  }
  commentActionId.value = "new";
  commentError.value = "";
  commentMessage.value = "";
  try {
    const created = await api.createArticleComment(userId.value, article.value.id, content);
    comments.value = [...comments.value, created];
    newCommentContent.value = "";
    commentMessage.value = "评论已发布";
  } catch (reason) {
    commentError.value = reason instanceof Error ? reason.message : "评论发布失败";
  } finally {
    commentActionId.value = "";
  }
}

function toggleReply(commentId: string) {
  replyingTo.value = replyingTo.value === commentId ? "" : commentId;
  replyContent.value = "";
  editingCommentId.value = "";
  commentError.value = "";
}

async function createReply(parentId: string) {
  if (!article.value || commentActionId.value) return;
  const content = replyContent.value.trim();
  if (!content) {
    commentError.value = "请输入回复内容";
    return;
  }
  commentActionId.value = `reply-${parentId}`;
  commentError.value = "";
  commentMessage.value = "";
  try {
    const created = await api.createArticleComment(userId.value, article.value.id, content, parentId);
    comments.value = [...comments.value, created];
    replyContent.value = "";
    replyingTo.value = "";
    commentMessage.value = "回复已发布";
  } catch (reason) {
    commentError.value = reason instanceof Error ? reason.message : "回复发布失败";
  } finally {
    commentActionId.value = "";
  }
}

function startEditing(comment: ArticleComment) {
  editingCommentId.value = comment.id;
  editContent.value = comment.content ?? "";
  replyingTo.value = "";
  commentError.value = "";
}

function cancelEditing() {
  editingCommentId.value = "";
  editContent.value = "";
}

async function saveComment(comment: ArticleComment) {
  if (!article.value || commentActionId.value) return;
  const content = editContent.value.trim();
  if (!content) {
    commentError.value = "评论内容不能为空";
    return;
  }
  commentActionId.value = `edit-${comment.id}`;
  commentError.value = "";
  commentMessage.value = "";
  try {
    const updated = await api.updateArticleComment(userId.value, article.value.id, comment.id, content);
    comments.value = comments.value.map((item) => item.id === updated.id ? updated : item);
    cancelEditing();
    commentMessage.value = "评论已更新";
  } catch (reason) {
    commentError.value = reason instanceof Error ? reason.message : "评论更新失败";
  } finally {
    commentActionId.value = "";
  }
}

async function deleteComment(comment: ArticleComment) {
  if (!article.value || commentActionId.value || !window.confirm("确定删除这条评论吗？回复内容仍会保留。")) return;
  commentActionId.value = `delete-${comment.id}`;
  commentError.value = "";
  commentMessage.value = "";
  try {
    await api.deleteArticleComment(userId.value, article.value.id, comment.id);
    await loadComments(article.value.id);
    commentMessage.value = "评论已删除";
    if (editingCommentId.value === comment.id) cancelEditing();
  } catch (reason) {
    commentError.value = reason instanceof Error ? reason.message : "评论删除失败";
  } finally {
    commentActionId.value = "";
  }
}

async function toggleLike() {
  if (!article.value || !interaction.value || interactionBusy.value) return;
  interactionBusy.value = true;
  interactionMessage.value = "";
  try {
    interaction.value = await api.setArticleLike(userId.value, article.value.id, !interaction.value.liked);
  } catch (reason) {
    interactionMessage.value = reason instanceof Error ? reason.message : "点赞操作失败";
  } finally {
    interactionBusy.value = false;
  }
}

async function toggleFavorite() {
  if (!article.value || !interaction.value || interactionBusy.value) return;
  interactionBusy.value = true;
  interactionMessage.value = "";
  try {
    interaction.value = await api.setArticleFavorite(userId.value, article.value.id, !interaction.value.favorited);
  } catch (reason) {
    interactionMessage.value = reason instanceof Error ? reason.message : "收藏操作失败";
  } finally {
    interactionBusy.value = false;
  }
}

async function toggleVersions() {
  if (versionsVisible.value) {
    versionsVisible.value = false;
    return;
  }
  busy.value = true;
  message.value = "";
  try {
    versions.value = await api.listArticleVersions(userId.value, props.id);
    versionsVisible.value = true;
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "历史版本加载失败";
  } finally {
    busy.value = false;
  }
}

async function withdraw() {
  if (!article.value) return;
  busy.value = true;
  message.value = "";
  try {
    article.value = await api.withdrawArticle(userId.value, article.value.id);
    message.value = "文章已撤回，现在可以重新编辑";
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章撤回失败";
  } finally {
    busy.value = false;
  }
}

async function remove() {
  if (!article.value || !window.confirm(`确定删除《${article.value.title}》吗？该操作会保留审计记录。`)) return;
  busy.value = true;
  try {
    await api.deleteArticle(userId.value, article.value.id);
    await router.push("/articles");
  } catch (reason) {
    message.value = reason instanceof Error ? reason.message : "文章删除失败";
    busy.value = false;
  }
}

onMounted(loadArticle);
watch([userId, () => props.id], loadArticle);
</script>

<template>
  <section class="article-view">
    <RouterLink class="back-link" to="/articles"><ArrowLeft :size="16" /> 返回我的文章</RouterLink>
    <p v-if="error" class="error-message">{{ error }}</p>
    <template v-else-if="article">
      <div class="reading-surface">
        <header class="article-header">
          <span class="status-badge" :data-status="article.status">{{ articleStatusLabels[article.status] }}</span>
          <h1>{{ article.title }}</h1>
          <div class="article-meta">
            <span><UserRound :size="15" /> {{ article.authorId }}</span>
            <span><Tag :size="15" /> {{ article.tagIds.join(" · ") || "无标签" }}</span>
            <span><FolderOpen :size="15" /> {{ article.categoryId || "未分类" }}</span>
            <span><Clock3 :size="15" /> 企业知识库</span>
          </div>
          <div v-if="article.status === 'PUBLISHED'" class="article-interactions">
            <span class="view-count"><Eye :size="17" /> {{ interaction?.viewCount ?? "—" }} 次阅读</span>
            <button
              class="interaction-button"
              :class="{ active: interaction?.liked }"
              type="button"
              :disabled="interactionBusy || !interaction"
              :aria-pressed="interaction?.liked ?? false"
              @click="toggleLike"
            >
              <Heart :size="17" /> {{ interaction?.likeCount ?? 0 }} {{ interaction?.liked ? "已点赞" : "点赞" }}
            </button>
            <button
              class="interaction-button"
              :class="{ active: interaction?.favorited }"
              type="button"
              :disabled="interactionBusy || !interaction"
              :aria-pressed="interaction?.favorited ?? false"
              @click="toggleFavorite"
            >
              <Bookmark :size="17" /> {{ interaction?.favoriteCount ?? 0 }} {{ interaction?.favorited ? "已收藏" : "收藏" }}
            </button>
          </div>
          <p v-if="interactionMessage" class="interaction-message" role="status">{{ interactionMessage }}</p>
          <div v-if="canManage" class="article-detail-actions">
            <RouterLink v-if="canEditArticle(article)" class="button secondary compact" :to="`/articles/${article.id}/edit`">
              <FilePenLine :size="15" /> 编辑
            </RouterLink>
            <button
              v-if="canWithdrawArticle(article)"
              class="button secondary compact"
              type="button"
              :disabled="busy"
              @click="withdraw"
            >
              <RotateCcw :size="15" /> 撤回
            </button>
            <button class="button secondary compact" type="button" :disabled="busy" @click="toggleVersions">
              <History :size="15" /> {{ versionsVisible ? "收起版本" : "历史版本" }}
            </button>
            <button class="button danger compact" type="button" :disabled="busy" @click="remove">
              <Trash2 :size="15" /> 删除
            </button>
          </div>
        </header>
        <p class="status-message" role="status">{{ message }}</p>
        <article class="article-body" v-html="article.renderedHtml"></article>
      </div>
      <section v-if="versionsVisible" class="version-history" aria-labelledby="version-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">变更记录</p>
            <h2 id="version-title">内容版本</h2>
          </div>
          <span>{{ versions.length }} 个版本</span>
        </div>
        <ol>
          <li v-for="version in versions" :key="version.versionNo">
            <div>
              <strong>版本 {{ version.versionNo }} · {{ version.title }}</strong>
              <span>{{ new Date(version.createdAt).toLocaleString("zh-CN") }} · {{ version.createdBy }}</span>
            </div>
            <p>{{ version.plainText }}</p>
          </li>
        </ol>
        <p v-if="!versions.length" class="muted">暂无历史版本。</p>
      </section>
      <section v-if="article.status === 'PUBLISHED'" class="comment-section" aria-labelledby="comment-title">
        <div class="section-heading comment-section-heading">
          <div>
            <p class="eyebrow"><MessageCircle :size="14" /> 团队讨论</p>
            <h2 id="comment-title">评论与回复</h2>
          </div>
          <span>{{ commentCount }} 条可见讨论</span>
        </div>

        <form class="comment-compose" @submit.prevent="createComment">
          <label for="new-comment">以 {{ displayAuthor(userId) }} 身份参与讨论</label>
          <textarea
            id="new-comment"
            v-model="newCommentContent"
            rows="4"
            maxlength="2000"
            :disabled="Boolean(commentActionId)"
            placeholder="补充经验、提出问题，或说明这篇内容的适用边界……"
          ></textarea>
          <div class="comment-compose-footer">
            <span>{{ newCommentContent.length }} / 2000</span>
            <button class="button primary compact" type="submit" :disabled="Boolean(commentActionId) || !newCommentContent.trim()">
              <Send :size="15" /> {{ commentActionId === "new" ? "发布中…" : "发表评论" }}
            </button>
          </div>
        </form>

        <p v-if="commentError" class="error-message comment-feedback" role="alert">{{ commentError }}</p>
        <p v-else-if="commentMessage" class="status-message comment-feedback" role="status">{{ commentMessage }}</p>
        <p v-if="commentsLoading" class="muted comment-loading">正在加载团队讨论...</p>

        <div v-else-if="commentThreads.length" class="comment-thread-list">
          <article v-for="thread in commentThreads" :key="thread.root.id" class="comment-thread">
            <div class="comment-card" :class="{ governed: commentPlaceholder(thread.root) }">
              <span class="comment-avatar" aria-hidden="true">{{ authorInitial(thread.root.authorId) }}</span>
              <div class="comment-main">
                <header class="comment-meta">
                  <div><strong>{{ displayAuthor(thread.root.authorId) }}</strong><span>{{ thread.root.authorId }}</span></div>
                  <time :datetime="thread.root.createdAt">
                    {{ formatCommentTime(thread.root.createdAt) }}
                    <small v-if="thread.root.updatedAt !== thread.root.createdAt && !commentPlaceholder(thread.root)">已编辑</small>
                  </time>
                </header>

                <form v-if="editingCommentId === thread.root.id" class="comment-inline-form" @submit.prevent="saveComment(thread.root)">
                  <textarea v-model="editContent" rows="3" maxlength="2000" :disabled="Boolean(commentActionId)"></textarea>
                  <div>
                    <span>{{ editContent.length }} / 2000</span>
                    <button class="text-action" type="button" :disabled="Boolean(commentActionId)" @click="cancelEditing"><X :size="14" /> 取消</button>
                    <button class="button primary compact" type="submit" :disabled="Boolean(commentActionId) || !editContent.trim()">
                      <Send :size="14" /> 保存
                    </button>
                  </div>
                </form>
                <p v-else-if="commentPlaceholder(thread.root)" class="comment-placeholder">{{ commentPlaceholder(thread.root) }}</p>
                <p v-else class="comment-content">{{ thread.root.content }}</p>

                <div v-if="editingCommentId !== thread.root.id && !commentPlaceholder(thread.root)" class="comment-actions">
                  <button class="text-action" type="button" :disabled="Boolean(commentActionId)" @click="toggleReply(thread.root.id)">
                    <Reply :size="14" /> {{ replyingTo === thread.root.id ? "收起回复" : "回复" }}
                  </button>
                  <button
                    v-if="canManageComment(thread.root, userId)"
                    class="text-action"
                    type="button"
                    :disabled="Boolean(commentActionId)"
                    @click="startEditing(thread.root)"
                  >
                    <Pencil :size="13" /> 编辑
                  </button>
                  <button
                    v-if="canManageComment(thread.root, userId)"
                    class="text-action danger-text"
                    type="button"
                    :disabled="Boolean(commentActionId)"
                    @click="deleteComment(thread.root)"
                  >
                    <Trash2 :size="13" /> 删除
                  </button>
                </div>

                <form v-if="replyingTo === thread.root.id" class="comment-inline-form reply-form" @submit.prevent="createReply(thread.root.id)">
                  <label :for="`reply-${thread.root.id}`">回复 {{ displayAuthor(thread.root.authorId) }}</label>
                  <textarea
                    :id="`reply-${thread.root.id}`"
                    v-model="replyContent"
                    rows="3"
                    maxlength="2000"
                    :disabled="Boolean(commentActionId)"
                    placeholder="写下你的回复……"
                  ></textarea>
                  <div>
                    <span>{{ replyContent.length }} / 2000</span>
                    <button class="text-action" type="button" :disabled="Boolean(commentActionId)" @click="toggleReply(thread.root.id)"><X :size="14" /> 取消</button>
                    <button class="button primary compact" type="submit" :disabled="Boolean(commentActionId) || !replyContent.trim()">
                      <Send :size="14" /> 发布回复
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div v-if="thread.replies.length" class="comment-replies">
              <div v-for="reply in thread.replies" :key="reply.id" class="comment-card reply-card" :class="{ governed: commentPlaceholder(reply) }">
                <span class="comment-avatar" aria-hidden="true">{{ authorInitial(reply.authorId) }}</span>
                <div class="comment-main">
                  <header class="comment-meta">
                    <div><strong>{{ displayAuthor(reply.authorId) }}</strong><span>回复 {{ displayAuthor(thread.root.authorId) }}</span></div>
                    <time :datetime="reply.createdAt">
                      {{ formatCommentTime(reply.createdAt) }}
                      <small v-if="reply.updatedAt !== reply.createdAt && !commentPlaceholder(reply)">已编辑</small>
                    </time>
                  </header>

                  <form v-if="editingCommentId === reply.id" class="comment-inline-form" @submit.prevent="saveComment(reply)">
                    <textarea v-model="editContent" rows="3" maxlength="2000" :disabled="Boolean(commentActionId)"></textarea>
                    <div>
                      <span>{{ editContent.length }} / 2000</span>
                      <button class="text-action" type="button" :disabled="Boolean(commentActionId)" @click="cancelEditing"><X :size="14" /> 取消</button>
                      <button class="button primary compact" type="submit" :disabled="Boolean(commentActionId) || !editContent.trim()">
                        <Send :size="14" /> 保存
                      </button>
                    </div>
                  </form>
                  <p v-else-if="commentPlaceholder(reply)" class="comment-placeholder">{{ commentPlaceholder(reply) }}</p>
                  <p v-else class="comment-content">{{ reply.content }}</p>

                  <div v-if="editingCommentId !== reply.id && canManageComment(reply, userId)" class="comment-actions">
                    <button class="text-action" type="button" :disabled="Boolean(commentActionId)" @click="startEditing(reply)">
                      <Pencil :size="13" /> 编辑
                    </button>
                    <button class="text-action danger-text" type="button" :disabled="Boolean(commentActionId)" @click="deleteComment(reply)">
                      <Trash2 :size="13" /> 删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        </div>
        <div v-else-if="!commentError" class="comment-empty">
          <MessageCircle :size="24" />
          <strong>还没有讨论</strong>
          <p>成为第一个补充经验或提出问题的人。</p>
        </div>
      </section>
    </template>
    <p v-else class="muted">正在加载文章...</p>
  </section>
</template>
