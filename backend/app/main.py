from fastapi import FastAPI

app = FastAPI(title="Japanese Reader")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
