# ScholarFlow Backend

当前版本：`v0.2.0`

这是第一阶段的后端基础架构，包含：

- FastAPI 应用和 `/health` 健康检查
- SQLite 本地开发默认配置
- PostgreSQL + pgvector、Redis、MinIO 的 Docker Compose 依赖
- 用户注册、登录和当前用户接口
- 工作区列表接口
- 基础安全、CORS 和配置管理
- 第一批 API 测试

## 本地运行

```powershell
cd backend
Copy-Item .env.example .env
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
uvicorn app.main:app --reload
```

打开 `http://localhost:8000/docs` 查看 OpenAPI 文档。

## 运行测试

```powershell
cd backend
pytest
```
