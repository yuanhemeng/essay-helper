# ScholarFlow 论文工作台

这是一个 AI 辅助交互式论文阅读、写作与投稿助手的原型项目，包含前端原型和 FastAPI 后端基础架构。

## 当前进展

- **v0.1.0 前端原型**：文献库、阅读器、批注、AI 问答、研究树、投稿助手等界面
- **v0.2.0 后端基础**：用户注册登录、工作区接口、SQLite 本地开发配置，以及 PostgreSQL + pgvector、Redis、MinIO 的 Docker Compose 依赖

版本记录见 [`CHANGELOG.md`](./CHANGELOG.md)。

## 前端原型

直接双击 `index.html` 即可打开；也可以在项目目录运行：

```powershell
python -m http.server 5173
```

然后访问 `http://localhost:5173`。

当前已具备：

- 文献库、分类、最近打开和文献搜索
- PDF 拖拽上传入口
- 阅读器目录、页码跳转、缩放和全屏阅读
- 正文选择后的荧光标注与批注入口
- AI 问论文、快捷问题和专业词库入口
- 研究树视图与关联文献
- 投稿助手视图、期刊推荐和投稿准备度清单

## 后端

完整说明见 [`backend/README.md`](./backend/README.md)，简要步骤：

```powershell
cd backend
Copy-Item .env.example .env   # 首次运行需要；SECRET_KEY 为必填项
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

打开 `http://localhost:8000/docs` 查看 OpenAPI 文档。

可选基础设施（PostgreSQL + pgvector、Redis、MinIO）：

```powershell
docker compose up -d
```

## 项目结构

```text
.
├── index.html / app.js / styles.css   # 前端原型
├── backend/                           # FastAPI 后端
│   ├── app/                           # 应用代码（api、core、db、models、schemas）
│   ├── tests/                         # API 测试
│   ├── .env.example                   # 环境变量模板（复制为 .env）
│   ├── Dockerfile
│   └── pyproject.toml
├── docs/                              # 产品需求文档与后端规划
├── docker-compose.yml                 # 本地基础设施依赖
└── CHANGELOG.md
```

## 下一阶段

下一步应接入真实 PDF.js 渲染与文本层、论文解析任务队列、向量检索、模型服务和期刊数据源。产品范围和阶段拆分见 [`docs/PRD.md`](./docs/PRD.md)，后端架构见 [`docs/BACKEND_PLAN.md`](./docs/BACKEND_PLAN.md)。
