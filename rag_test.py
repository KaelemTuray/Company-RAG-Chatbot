import boto3

REGION = "us-east-1"
KB_ID = "XWGIVLOJ61"
MODEL_ID = "us.amazon.nova-pro-v1:0"

agent = boto3.client("bedrock-agent-runtime", region_name=REGION)
bedrock = boto3.client("bedrock-runtime", region_name=REGION)

SYSTEM = (
    "You answer questions using ONLY the provided context. "
    "If the context does not contain the answer, say you don't have that "
    "information. Be concise and mention which source file you used."
)

def ask(question):
    r = agent.retrieve(
        knowledgeBaseId=KB_ID,
        retrievalQuery={"text": question},
        retrievalConfiguration={
            "vectorSearchConfiguration": {"numberOfResults": 5}
        },
    )
    chunks = r["retrievalResults"]

    context = "\n\n".join(
        f"[Source: {c['location']['s3Location']['uri'].split('/')[-1]}]\n"
        f"{c['content']['text']}"
        for c in chunks
    )
    sources = sorted(
        {c["location"]["s3Location"]["uri"].split("/")[-1] for c in chunks}
    )

    resp = bedrock.converse(
        modelId=MODEL_ID,
        system=[{"text": SYSTEM}],
        messages=[{
            "role": "user",
            "content": [{"text": f"Context:\n{context}\n\nQuestion: {question}"}],
        }],
        inferenceConfig={"maxTokens": 800},
    )
    answer = resp["output"]["message"]["content"][0]["text"]
    return answer, sources

if __name__ == "__main__":
    while True:
        q = input("\nQuestion (or 'quit'): ").strip()
        if q.lower() in ("quit", "exit", ""):
            break
        answer, sources = ask(q)
        print("\n" + answer)
        print("\nRetrieved from:", ", ".join(sources))
