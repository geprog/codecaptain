import os
import sys
import time
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.chains import ConversationalRetrievalChain
from langchain.memory import ConversationBufferMemory
from langchain.chat_models import ChatOpenAI
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

data_path = os.getenv("DATA_PATH")

chatMemories = {}


def _cleanup_chats():
    for chat_id in chatMemories.keys():
        # drop chats that are older than 5 minutes
        if time.time() - chatMemories[chat_id]["lastQuestion"] > 5 * 60:
            del chatMemories[chat_id]


def _get_chat(chat_id: str):
    _cleanup_chats()

    if chat_id not in chatMemories:
        chatMemories[chat_id] = {
            "memory": ConversationBufferMemory(
                memory_key="chat_history", return_messages=True, output_key="answer"
            ),
            "lastQuestion": time.time(),
        }

    chatMemories[chat_id]["lastQuestion"] = time.time()

    return chatMemories[chat_id]["memory"]


def ask(repo_id: int, chat_id: str, question: str):
    embeddings = OpenAIEmbeddings(disallowed_special=())

    repo_path = os.path.join(data_path, str(repo_id))

    db = FAISS.load_local(os.path.join(repo_path, "vector_store"), embeddings)

    retriever = db.as_retriever()
    end = time.time()

    retriever.search_kwargs["distance_metric"] = "cos"
    retriever.search_kwargs["fetch_k"] = 100
    retriever.search_kwargs["maximal_marginal_relevance"] = True
    retriever.search_kwargs["k"] = 20

    memory = _get_chat(chat_id)

    qa = ConversationalRetrievalChain.from_llm(
        llm=ChatOpenAI(temperature=0),
        memory=memory,
        retriever=retriever,
        return_source_documents=True,
    )
    end = time.time()

    result = qa(question)
    print(f"Answer: {result['answer']}")
    print(f"Sources: {[x.metadata['source'] for x in result['source_documents']]}")
    end = time.time()

    return result["answer"], [x.metadata["source"] for x in result["source_documents"]]


if __name__ == "__main__":
    # print(f">>>{sys.argv}<<<\n")
    ask(sys.argv[1], sys.argv[2])
