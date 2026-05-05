MODEL_CATALOG = {
    "google": {
        "label": "Google Gemini",
        "api_key_env": "GOOGLE_API_KEY",
        "models": [
            {
                "id": "gemini-3-flash-preview",
                "label": "Gemini 3 Flash Preview",
                "recommended": False,
                "notes": "Latest Gemini 3 Flash preview model with strong speed-to-quality balance.",
            },
            {
                "id": "gemini-2.5-flash-lite",
                "label": "Gemini 2.5 Flash-Lite",
                "recommended": True,
                "notes": "Lowest-cost Gemini option for extraction and testing.",
            },
            {
                "id": "gemini-2.5-flash",
                "label": "Gemini 2.5 Flash",
                "recommended": False,
                "notes": "Balanced price-performance Gemini model.",
            },
            {
                "id": "gemini-2.5-pro",
                "label": "Gemini 2.5 Pro",
                "recommended": False,
                "notes": "Highest-quality Gemini reasoning model.",
            },
        ],
    },
    "openai": {
        "label": "OpenAI",
        "api_key_env": "OPENAI_API_KEY",
        "models": [
            {
                "id": "gpt-4o-mini",
                "label": "GPT-4o mini",
                "recommended": True,
                "notes": "Affordable structured-output model for focused tasks.",
            },
            {
                "id": "gpt-4.1-mini",
                "label": "GPT-4.1 mini",
                "recommended": False,
                "notes": "Fast GPT-4.1 variant with large context window.",
            },
            {
                "id": "gpt-4.1",
                "label": "GPT-4.1",
                "recommended": False,
                "notes": "Higher-quality OpenAI non-reasoning model.",
            },
        ],
    },
    "anthropic": {
        "label": "Anthropic",
        "api_key_env": "ANTHROPIC_API_KEY",
        "models": [
            {
                "id": "claude-3-5-haiku-latest",
                "label": "Claude 3.5 Haiku",
                "recommended": True,
                "notes": "Cheaper Anthropic model for lightweight extraction.",
            },
            {
                "id": "claude-3-7-sonnet-latest",
                "label": "Claude 3.7 Sonnet",
                "recommended": False,
                "notes": "Strong all-around Claude model.",
            },
            {
                "id": "claude-sonnet-4-20250514",
                "label": "Claude Sonnet 4",
                "recommended": False,
                "notes": "Higher-end Anthropic reasoning model.",
            },
        ],
    },
}

FIXED_EMBEDDING_PROVIDER = "google"
FIXED_EMBEDDING_MODEL = "gemini-embedding-001"
FALLBACK_EMBEDDING_PROVIDER = "deterministic"
FALLBACK_EMBEDDING_MODEL = "deterministic-1536"

DEFAULT_PROVIDER = "google"
DEFAULT_MODEL = "gemini-2.5-flash-lite"
