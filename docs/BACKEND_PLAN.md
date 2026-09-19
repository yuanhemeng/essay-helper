# ScholarFlow 后端开发规划 v0.1

## 1. 已确认的产品边界

| 项目 | 第一阶段决定 |
| --- | --- |
| 用户 | 个人使用，单用户优先 |
| 形态 | Web 应用，后续可演进为桌面应用 |
| 文献规模 | 个人几百篇，架构预留未来上万篇 |
| 文件策略 | 普通 PDF 可上云；内部材料必须保持本地 |
| AI | 通过 API 调用，模型供应商可替换 |
| 学科 | 计算机为主，兼容中文和英文论文 |
| 写作 | 支持完整论文编辑，而不只是片段生成 |
| 协作 | 暂不实现多人协作，但保留用户和权限边界 |
| 投稿 | 中文、英文期刊都支持；允许访问公开投稿指南 |
| 导出 | LaTeX、PDF、BibTeX 优先 |
| 账号 | 需要登录、跨设备同步和自动备份 |

## 2. 重要设计结论

### 2.1 云端模式与本地模式必须隔离

“PDF 可以上云”和“内部材料完全本地”不能只靠一个前端开关保证。建议定义两种明确的工作区：

- **Cloud Workspace**：PDF、解析文本、向量索引和 AI 请求可以进入云端，支持跨设备同步和完整 AI 能力。
- **Local Vault**：原始 PDF、解析结果、批注、向量索引和写作内容均保存在用户设备；默认不上传服务器，不参与云端检索。

第一阶段网页应用可以先完整实现 Cloud Workspace。Local Vault 建议以本地服务或桌面壳实现，而不是把安全责任交给浏览器缓存：

```text
浏览器
  ├── 云端模式 -> HTTPS -> API 服务 -> 对象存储 / 数据库 / AI 网关
  └── 本地模式 -> localhost Local Agent -> 本地文件、SQLite、向量索引、可选本地模型
```

后续 Electron 或 Tauri 桌面端可以复用同一个 Local Agent。这样既满足内部材料不出设备，也不会让云端后端误接触私密数据。

### 2.2 第一阶段先做“模块化单体”

当前是个人产品，直接拆微服务会增加部署和调试成本。建议使用模块化单体：

- 一个 FastAPI API 服务
- 一个异步 Worker 进程
- PostgreSQL
- Redis
- S3 兼容对象存储
- 独立的 AI Provider Adapter

代码按领域模块拆分，未来需要扩容时再把解析、检索和 AI 服务独立出去。

## 3. 推荐技术栈

### 3.1 后端

- Python 3.12+
- FastAPI：HTTP API、SSE 流式响应、自动 OpenAPI
- SQLAlchemy 2 + Alembic：数据库访问与迁移
- Pydantic v2：请求、响应和配置校验
- `arq` 或 Celery：异步解析和导出任务
- Redis：任务队列、缓存、短期会话状态

### 3.2 数据和文件

- PostgreSQL 16：用户、文献、批注、写作、任务和投稿数据
- `pgvector`：第一阶段的向量检索，降低系统复杂度
- S3 兼容对象存储：PDF、图片、导出包和解析中间产物
- 本地开发使用 Docker Compose；生产环境可使用托管 PostgreSQL 和对象存储

### 3.3 PDF 与学术解析

- PDF.js：浏览器端渲染和文本选择
- PyMuPDF：页级文本和版面基础解析
- GROBID：论文元数据、章节、参考文献和学术结构解析
- OCR：对扫描 PDF 增加 PaddleOCR 或 Tesseract 适配器
- 公式、表格、图片先保存为结构化块，复杂识别作为后续能力

### 3.4 AI

定义统一接口，不在业务代码中直接依赖某个厂商：

```python
class ModelProvider(Protocol):
    async def chat(self, request: ChatRequest) -> ChatResponse: ...
    async def stream_chat(self, request: ChatRequest) -> AsyncIterator[str]: ...
    async def embed(self, texts: list[str]) -> list[list[float]]: ...
    async def rerank(self, query: str, documents: list[str]) -> list[float]: ...
```

第一阶段可实现 OpenAI-compatible Provider，同时保留本地模型、其他云端模型和自定义网关适配器。

## 4. 系统架构

```text
Web Frontend
    |
    | HTTPS / SSE
    v
FastAPI API
    |-- Auth & Workspace
    |-- Library & Annotation
    |-- Writing & Export
    |-- Search & Retrieval
    |-- Journal & Submission
    |-- AI Gateway
    |
    +--> PostgreSQL + pgvector
    +--> Redis
    +--> S3 Object Storage
    +--> Job Worker
              |-- PDF extraction
              |-- GROBID / OCR
              |-- chunking & embedding
              |-- export rendering
              |-- journal guide fetch
```

## 5. 数据库核心模型

### 5.1 账户和工作区

- `users`
  - `id`, `email`, `display_name`, `password_hash`, `created_at`
- `workspaces`
  - `id`, `owner_id`, `name`, `mode` (`cloud` / `local`), `created_at`
- `workspace_settings`
  - `workspace_id`, `default_language`, `citation_style`, `ai_provider`, `retention_policy`

即使第一阶段只有一个用户，也保留 `workspace_id`。未来增加多用户时，可以在工作区层增加成员和角色，不需要重做文献数据。

### 5.2 文献和解析结果

- `documents`
  - `id`, `workspace_id`, `title`, `authors`, `abstract`, `year`, `venue`, `doi`
  - `storage_mode`, `object_key`, `file_hash`, `page_count`, `parse_status`
- `document_pages`
  - `id`, `document_id`, `page_number`, `text`, `layout_json`, `thumbnail_key`
- `document_blocks`
  - `id`, `document_id`, `page_id`, `block_type`, `content`, `bbox`, `section_path`
- `document_references`
  - `id`, `document_id`, `raw_text`, `cited_title`, `doi`, `resolved_document_id`
- `document_chunks`
  - `id`, `document_id`, `page_start`, `page_end`, `section_path`, `content`, `embedding`

### 5.3 分类、批注和词库

- `collections`
  - `id`, `workspace_id`, `name`, `color`
- `document_collections`
  - `document_id`, `collection_id`
- `annotations`
  - `id`, `document_id`, `page_number`, `annotation_type`, `quote`, `range_json`
  - `color`, `note`, `created_at`, `updated_at`
- `terms`
  - `id`, `workspace_id`, `source_term`, `preferred_translation`, `definition`
  - `domain`, `examples`, `confidence`, `updated_at`

### 5.4 对话、研究树和写作

- `conversations`
  - `id`, `workspace_id`, `document_id`, `title`, `mode`
- `messages`
  - `id`, `conversation_id`, `role`, `content`, `created_at`
- `message_citations`
  - `message_id`, `document_id`, `page_number`, `chunk_id`, `quote`, `score`
- `research_nodes`
  - `id`, `workspace_id`, `parent_id`, `node_type`, `title`, `description`, `status`, `position_json`
- `research_node_documents`
  - `node_id`, `document_id`, `relation_type`
- `manuscripts`
  - `id`, `workspace_id`, `title`, `format`, `content_json`, `version`, `updated_at`
- `manuscript_sections`
  - `id`, `manuscript_id`, `parent_id`, `heading`, `content_json`, `sort_order`
- `manuscript_citations`
  - `section_id`, `document_id`, `citation_key`, `locator`

### 5.5 任务、导出和投稿

- `jobs`
  - `id`, `workspace_id`, `type`, `status`, `progress`, `payload_json`, `error`, `created_at`
- `exports`
  - `id`, `manuscript_id`, `format`, `status`, `object_key`, `created_at`
- `journals`
  - `id`, `title`, `issn`, `language`, `publisher_url`, `submission_url`
- `journal_guides`
  - `id`, `journal_id`, `source_url`, `fetched_at`, `content`, `requirements_json`
- `submission_projects`
  - `id`, `manuscript_id`, `journal_id`, `readiness_score`, `checklist_json`

## 6. PDF 导入和解析流程

```text
1. 前端请求上传凭证
2. 后端返回短期、限制大小和 MIME 的对象存储 URL
3. 浏览器直传 PDF，避免 API 服务承载大文件
4. 前端通知后端完成上传
5. 后端校验文件哈希、大小、真实 MIME 和病毒扫描结果
6. 创建 document 与 parse job
7. Worker 提取页文本和版面块
8. 尝试识别元数据、目录、参考文献和章节
9. 文本不足时进入 OCR 分支
10. 按章节和页码切块
11. 生成 embedding，写入 pgvector
12. 更新 parse_status，推送任务进度
```

解析任务需要幂等：相同 `file_hash` 在同一个工作区中不重复解析；解析失败可以从最近成功阶段重试。

## 7. AI 问答流程

```text
用户问题
  -> 识别上下文：当前文献 / 当前页 / 选中文本 / 工作区
  -> 查询词库和用户偏好
  -> pgvector 初筛
  -> 可选 rerank
  -> 组装带页码的证据片段
  -> ModelProvider 流式生成
  -> 引用校验
  -> SSE 返回文字和 citations
  -> 保存消息与引用证据
```

回答协议必须区分：

- `answer`：自然语言答案
- `citations`：文献、页码、原文、chunk id
- `confidence`：检索和回答置信度
- `disclaimer`：推断、外部推荐或未验证信息提示

服务端禁止只保存模型最终文本而丢掉证据片段，否则后续无法审计和复现。

## 8. API 规划

### 8.1 认证和工作区

```text
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
GET    /api/v1/me
GET    /api/v1/workspaces
POST   /api/v1/workspaces
PATCH  /api/v1/workspaces/{workspace_id}
```

### 8.2 文献和文件

```text
POST   /api/v1/uploads/presign
POST   /api/v1/documents/complete-upload
GET    /api/v1/documents
GET    /api/v1/documents/{document_id}
DELETE /api/v1/documents/{document_id}
GET    /api/v1/documents/{document_id}/pages/{page_number}
GET    /api/v1/documents/{document_id}/outline
GET    /api/v1/documents/{document_id}/references
GET    /api/v1/documents/{document_id}/jobs
```

### 8.3 搜索和 AI

```text
GET    /api/v1/search?q=&workspace_id=
POST   /api/v1/conversations
GET    /api/v1/conversations/{conversation_id}
POST   /api/v1/conversations/{conversation_id}/messages
GET    /api/v1/conversations/{conversation_id}/stream
POST   /api/v1/documents/{document_id}/translate
POST   /api/v1/documents/{document_id}/summarize
POST   /api/v1/recommendations/papers
```

问答和生成接口建议使用 SSE，返回如下事件：

```text
event: token
data: {"text":"..."}

event: citation
data: {"document_id":"...","page":27,"quote":"..."}

event: done
data: {"message_id":"..."}
```

### 8.4 批注、词库、写作和导出

```text
POST   /api/v1/documents/{document_id}/annotations
GET    /api/v1/documents/{document_id}/annotations
PATCH  /api/v1/annotations/{annotation_id}
DELETE /api/v1/annotations/{annotation_id}

GET    /api/v1/terms
POST   /api/v1/terms
PATCH  /api/v1/terms/{term_id}

POST   /api/v1/manuscripts
GET    /api/v1/manuscripts/{manuscript_id}
PATCH  /api/v1/manuscripts/{manuscript_id}
POST   /api/v1/manuscripts/{manuscript_id}/ai-actions
POST   /api/v1/manuscripts/{manuscript_id}/exports
GET    /api/v1/exports/{export_id}
```

### 8.5 期刊和投稿

```text
GET    /api/v1/journals/recommendations
GET    /api/v1/journals/{journal_id}
POST   /api/v1/journals/{journal_id}/refresh-guide
POST   /api/v1/manuscripts/{manuscript_id}/submission-check
GET    /api/v1/submission-projects/{submission_project_id}
```

投稿指南抓取必须保存来源 URL、抓取时间、原始页面摘要和解析版本，模型只负责结构化，不能替代来源。

## 9. 账号、权限和安全

第一阶段虽然只有一个用户，也建议从一开始完成以下边界：

- Argon2id 密码哈希，短期 Access Token + 可撤销 Refresh Token
- 每个 API 请求校验 `workspace_id` 所属关系
- 对象存储使用私有 bucket 和短期签名 URL
- PDF 下载、导出下载均不暴露永久公开链接
- 上传限制扩展名、MIME、大小和文件哈希
- 记录 AI Provider、模型、提示版本和请求耗时
- API Key 加密保存，前端永不接触真实密钥
- 日志脱敏，默认不记录论文全文和完整模型提示
- 提供“删除文献并清理对象、解析块、向量和缓存”的级联任务

## 10. 本地私密文献的实现路线

### 第一阶段后端边界

云端后端只处理 `storage_mode=cloud` 的文献。前端可显示“本地模式”入口，但不要伪装成真正安全的本地存储。

### 第二阶段 Local Agent

实现一个本地进程：

- localhost HTTPS 或随机 Token 鉴权
- SQLite 保存文献元数据、批注和写作
- 本地文件目录保存 PDF
- 本地全文检索和向量索引
- 可调用本地模型，或由用户明确选择把某段文本发送到云端 AI
- 与 Web 前端通过浏览器本地连接通信

### 桌面化

使用 Tauri 或 Electron 打包 Web 前端 + Local Agent，云端模式仍然调用同一套远程 API。

## 11. 开发阶段

### 阶段 A：后端骨架，约 1 周

- FastAPI 项目结构、配置、日志和错误规范
- PostgreSQL、Redis、对象存储 Docker Compose
- 用户、工作区和 Token 认证
- Alembic 初始迁移
- OpenAPI 和健康检查
- CI：格式化、类型检查、单元测试

### 阶段 B：文献管线，约 2 周

- 直传、文件校验和文献 CRUD
- 异步任务状态
- PyMuPDF 文本抽取
- 目录、页文本和基础元数据
- 文本分块与 pgvector embedding
- 前端真实 PDF.js 阅读数据接口

### 阶段 C：阅读知识层，约 2 周

- 批注 API 和持久化
- 词库 API
- 语义搜索
- AI Provider Adapter
- 带引用证据的问答和翻译
- SSE 流式响应

### 阶段 D：完整写作，约 2-3 周

- 论文、章节和版本模型
- 自动保存和版本历史
- 引用键与 BibTeX
- LaTeX 导出
- PDF 编译任务
- 失败日志和导出产物管理

### 阶段 E：投稿与本地模式，约 2 周

- 期刊数据模型和指南抓取
- 投稿准备度检查
- 本地 Agent 原型
- Cloud / Local 工作区切换

以上是单人开发的粗略估算，实际时间会受 PDF 复杂度、模型接口和 LaTeX 模板范围影响。

## 12. 第一轮开发建议

第一轮不要先做期刊爬取或复杂关系图，建议按以下顺序开工：

1. 建立 FastAPI + PostgreSQL + Redis + MinIO 的本地开发环境。
2. 实现账户、工作区、上传、文献和异步任务。
3. 用 PyMuPDF 打通“上传 PDF -> 页文本 -> 目录 -> 可搜索”。
4. 用 pgvector 和统一模型适配器打通带页码引用的问答。
5. 将现有原型的假数据替换成真实 API。
6. 再实现写作编辑器、BibTeX 和 LaTeX/PDF 导出。

这样每个阶段都有可演示结果，并且能尽早验证最关键的风险：PDF 解析质量、引用证据可靠性和大文件处理成本。

## 13. 推荐目录结构

```text
backend/
  app/
    main.py
    core/
      config.py
      security.py
      logging.py
    db/
      session.py
      models/
      migrations/
    api/
      deps.py
      v1/
        auth.py
        workspaces.py
        documents.py
        annotations.py
        conversations.py
        manuscripts.py
        journals.py
    services/
      storage.py
      pdf_parser.py
      retrieval.py
      ai_gateway.py
      citation_validator.py
      export_service.py
    workers/
      queue.py
      document_tasks.py
      export_tasks.py
  tests/
  Dockerfile
  pyproject.toml
docker-compose.yml
```

## 14. 主要风险与对策

| 风险 | 对策 |
| --- | --- |
| 扫描 PDF 无文本 | OCR 分支、解析状态可见、允许用户手动补充 |
| 公式和表格解析差 | 先保留原图和版面块，后续按计算机论文重点优化 |
| AI 捏造引用 | 强制检索证据、引用校验、展示页码和原文 |
| 大文件拖慢 API | 对象存储直传，API 只处理元数据 |
| 未来上万篇文献 | 文件和向量分离；数据库索引、分页、异步导入 |
| 私密论文误上传 | 工作区级 storage mode 隔离；Local Agent 不走云端 |
| 投稿要求过期 | 保存来源和时间；每次展示明确“最后核验时间” |
| LaTeX 编译不稳定 | 沙箱编译、超时、资源限制和失败日志 |
