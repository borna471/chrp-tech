# Smoke-tests the hosted reviewer against one photo, returning the same
# verdict/message shape the app's AnalyzePhotoResult expects.
#
# Authentication comes from `hf auth login`, so no token belongs in this file.
# Paste your endpoint URL below, or export HF_ENDPOINT_URL to override it.

import base64
import json
import os

from huggingface_hub import InferenceClient
from huggingface_hub.errors import HfHubHTTPError

ENDPOINT_URL = os.environ.get("HF_ENDPOINT_URL", "https://gsbitp8isrqpumnj.us-east-1.aws.endpoints.huggingface.cloud")
PHOTO = "public/blurry-pipe-test.jpeg"

if not ENDPOINT_URL:
    raise SystemExit(
        "No endpoint configured. Set ENDPOINT_URL in this file, or export "
        "HF_ENDPOINT_URL=https://<id>.<region>.aws.endpoints.huggingface.cloud"
    )

SYSTEM = """You review homeowner photos for a home insurance assessment.
Reply with JSON only, no prose, in this exact shape:
{"verdict": "accepted" | "follow_up", "message": "<one sentence to the homeowner>"}
Use "follow_up" only when the photo is missing something the instruction asked for."""

INSTRUCTION = (
    "Task: Under the kitchen counter. "
    "The homeowner was asked to photograph both sides of the P-trap, the supply "
    "lines and both shutoff valves, and the cabinet floor. "
    "Judge whether those are visible, and note any water damage or corrosion."
)

# base_url and model are mutually exclusive here; the /v1/chat/completions
# suffix is appended to the endpoint URL for us. The token is picked up from the
# `hf auth login` cache.
client = InferenceClient(base_url=ENDPOINT_URL)

with open(PHOTO, "rb") as handle:
    data_uri = f"data:image/jpeg;base64,{base64.b64encode(handle.read()).decode()}"

try:
    completion = client.chat.completions.create(
        # The served model, whatever it is, answers to "tgi" on a TGI endpoint.
        model="Qwen/Qwen3-VL-4B-Instruct",
        max_tokens=300,
        temperature=0,
        messages=[
            {"role": "system", "content": SYSTEM},
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_uri}},
                    {"type": "text", "text": INSTRUCTION},
                ],
            },
        ],
    )
except HfHubHTTPError as error:
    # An endpoint scaled to zero answers 503 for the minute or two it takes to
    # boot, which is otherwise indistinguishable from a broken deployment.
    if error.response is not None and error.response.status_code == 503:
        raise SystemExit(
            "Endpoint is still initializing — wait for its status to read Running, then retry."
        ) from error
    raise

raw = completion.choices[0].message.content
print("Raw:", raw)
try:
    print("Parsed:", json.dumps(json.loads(raw), indent=2))
except json.JSONDecodeError:
    print("Model did not return valid JSON — this is the case parseVerdict must handle.")