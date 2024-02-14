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

chat_memories = {}


def _cleanup_chats():
    for chat_id in chat_memories.keys():
        # drop chats that are older than 5 minutes
        if (
            time.time() - chat_memories.get(chat_id, {}).get("lastQuestionTime")
            > 5 * 60
        ):
            chat_memories.pop(chat_id)


def _get_chat_memory(chat_id: str) -> ConversationBufferMemory:
    _cleanup_chats()

    chat_memories.setdefault(
        chat_id,
        {
            "memory": ConversationBufferMemory(
                memory_key="chat_history", return_messages=True, output_key="answer"
            ),
        },
    )
    chat_memories[chat_id]["lastQuestionTime"] = time.time()

    return chat_memories.get(chat_id).get("memory")


def ask(repo_id: int, chat_id: str, question: str):
    embeddings = OpenAIEmbeddings(disallowed_special=())

    repo_path = os.path.join(data_path, str(repo_id))

    db = FAISS.load_local(os.path.join(repo_path, "vector_store"), embeddings)

    retriever = db.as_retriever()

    retriever.search_kwargs["distance_metric"] = "cos"
    retriever.search_kwargs["fetch_k"] = 100
    retriever.search_kwargs["maximal_marginal_relevance"] = True
    retriever.search_kwargs["k"] = 20

    memory = _get_chat_memory(chat_id)

    agent = ConversationalRetrievalChain.from_llm(
        llm=ChatOpenAI(temperature=0, model='gpt-3.5-turbo-16k'),
        memory=memory,
        retriever=retriever,
        return_source_documents=True,
    )

    result = agent({'question': question})
    print(f"Answer: {result['answer']}")
    print(f"Sources: {[x.metadata['source'] for x in result['source_documents']]}")
    
    if memory is not None:
        memory.save_context({'question': question}, {'answer': result['answer']})

    return result["answer"], [x.metadata["source"] for x in result["source_documents"]]


if __name__ == "__main__":
    # print(f">>>{sys.argv}<<<\n")
    ask(sys.argv[1], sys.argv[2])
