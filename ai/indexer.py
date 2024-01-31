import os
import time
import sys
import meta_information
from langchain.document_loaders import TextLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.text_splitter import RecursiveCharacterTextSplitter, Language
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


data_path = os.getenv("DATA_PATH")


def generate_index(repo_id: int):
    repo_path = os.path.join(data_path, str(repo_id))

    docs = []

    print("indexing repo ...")
    # index repo
    code_splitter = text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, chunk_overlap=0, separators=[";", "/n", "}"]
    )
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "repo")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                docs.extend(loader.load_and_split(code_splitter))
            except Exception as e:
                pass

    # index file structure
    print("indexing file structure ...")
    meta_information.generate_file_structure_description(repo_path)
    docs.extend(
        TextLoader(
            os.path.join(repo_path, "file-structure.txt"), encoding="utf-8"
        ).load_and_split()
    )

    print("indexing issues ...")
    md_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.MARKDOWN,
        chunk_size=1000,
        chunk_overlap=0,
    )
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "issues")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                docs.extend(loader.load_and_split(md_splitter))
            except Exception as e:
                pass

    embeddingApi = OpenAIEmbeddings(chunk_size=1000)
    db = FAISS.from_documents(docs, embeddingApi, wait_time=30, batch_size=10)
    db.save_local(os.path.join(repo_path, "vector_store"))

    print("done")


if __name__ == "__main__":
    generate_index(sys.argv[1])
