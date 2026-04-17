from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://mpv2:mpv2@localhost:5432/mpv2"
    redis_url: str = "redis://localhost:6379/0"
    fal_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    mp_dir: str = ".mp"
    config_path: str = "config.json"

    class Config:
        env_file = ".env"


settings = Settings()
