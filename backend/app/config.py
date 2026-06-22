from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://ata:changeme@localhost:5432/ata_schedule"

    model_config = {"env_file": ".env"}


settings = Settings()
