from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
import boto3, json, uuid
import datetime
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

s3 = boto3.client(
    "s3",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

bedrock = boto3.client(
    "bedrock-runtime",
    region_name=os.getenv("AWS_REGION"),
    aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
    aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
)

BUCKET = os.getenv("S3_BUCKET_NAME")

@app.post("/generate")
async def generate_letter(
    recipient_name: str = Form(...),
    your_name: str = Form(...),
    relationship: str = Form(...),
    memories: str = Form(...),
    tone: str = Form(...),
    file: UploadFile = File(None),
):
    file_url = None
    if file:
        key = f"uploads/{uuid.uuid4()}_{file.filename}"
        s3.upload_fileobj(file.file, BUCKET, key)
        file_url = f"https://{BUCKET}.s3.amazonaws.com/{key}"

    prompt = f"""Write a heartfelt, personalized gratitude letter from {your_name} to {recipient_name}.

Relationship: {relationship}
Memories and reasons for gratitude: {memories}
Tone: {tone}
{f"They also included a photo/file as a memory: {file_url}" if file_url else ""}

Write a warm, genuine letter (3-4 paragraphs) that:
- Opens with a personal greeting
- References the specific memories and reasons shared
- Expresses deep, authentic gratitude
- Closes with a heartfelt sign-off

Do not include any preamble, just write the letter directly."""

    def stream():
        response = bedrock.invoke_model_with_response_stream(
            modelId="us.anthropic.claude-haiku-4-5-20251001-v1:0",
            body=json.dumps({
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 1024,
                "messages": [{"role": "user", "content": prompt}]
            })
        )
        for event in response["body"]:
            chunk = json.loads(event["chunk"]["bytes"])
            if chunk["type"] == "content_block_delta":
                yield chunk["delta"].get("text", "")

        @app.post("/save")
        async def save_letter(
            recipient_name: str = Form(...),
            your_name: str = Form(...),
            letter: str = Form(...),
        ):
            key = f"letters/{uuid.uuid4()}.json"
            data = json.dumps({
                "recipient_name": recipient_name,
                "your_name": your_name,
                "letter": letter,
                "saved_at": datetime.datetime.utcnow().isoformat()
            })
            s3.put_object(Bucket=BUCKET, Key=key, Body=data, ContentType="application/json")
            return {"status": "saved", "key": key}

        @app.get("/letters")
        async def get_letters():
            response = s3.list_objects_v2(Bucket=BUCKET, Prefix="letters/")
            letters = []
            for obj in response.get("Contents", []):
                body = s3.get_object(Bucket=BUCKET, Key=obj["Key"])
                letters.append(json.loads(body["Body"].read()))
            letters.sort(key=lambda x: x["saved_at"], reverse=True)
            return letters
    return StreamingResponse(stream(), media_type="text/plain")