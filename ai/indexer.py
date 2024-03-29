import os
import time
import sys
import meta_information
from langchain.document_loaders import TextLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


data_path = os.getenv("DATA_PATH")


def generate_index(repo_id: int):
    repo_path = os.path.join(data_path, str(repo_id))

    embeddings = OpenAIEmbeddings(disallowed_special=())
    docs = []

    # index repo
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "repo")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                docs.extend(loader.load_and_split())
            except Exception as e:
                pass

    # index file structure
    meta_information.generate_file_structure_description(repo_path)
    docs.extend(
        TextLoader(
            os.path.join(repo_path, "file-structure.txt"), encoding="utf-8"
        ).load_and_split()
    )

    # index issues
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "issues")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                docs.extend(loader.load_and_split())
            except Exception as e:
                pass

    db = FAISS.from_documents(docs, embeddings)
    db.save_local(os.path.join(repo_path, "vector_store"))

    print("done")


if __name__ == "__main__":
    generate_index(sys.argv[1])
