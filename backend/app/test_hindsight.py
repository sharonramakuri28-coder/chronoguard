import os
from pathlib import Path
from dotenv import load_dotenv
from hindsight_client import Hindsight

# Find .env in the backend folder
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"

load_dotenv(ENV_FILE)

api_key = os.getenv("HINDSIGHT_API_KEY")
base_url = os.getenv("HINDSIGHT_BASE_URL")
bank_id = os.getenv("HINDSIGHT_BANK_ID")

print("API key loaded:", bool(api_key))
print("Base URL:", base_url)
print("Bank ID:", bank_id)

if not api_key:
    raise RuntimeError("HINDSIGHT_API_KEY was not loaded from .env")

if not base_url:
    raise RuntimeError("HINDSIGHT_BASE_URL was not loaded from .env")

if not bank_id:
    raise RuntimeError("HINDSIGHT_BANK_ID was not loaded from .env")

client = Hindsight(
    base_url=base_url,
    api_key=api_key
)

try:
    bank = client.create_bank(
        bank_id=bank_id,
        name="ChronoGuard"
    )

    print("Hindsight connection successful!")
    print("Memory bank:", bank.bank_id)

finally:
    client.close()