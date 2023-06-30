import os
import time
import sys
from meta_information import generate_project_structure_description
from langchain.document_loaders import TextLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import DeepLake
from langchain.text_splitter import CharacterTextSplitter
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


data_path = os.getenv("DATA_PATH")


def update_index_with_issues(repo_path, issueFilenames):
    embeddings = OpenAIEmbeddings(disallowed_special=())
    db = DeepLake(
        dataset_path=os.path.join(repo_path, "vector_store"),
        embedding_function=embeddings,
        overwrite=True,
    )  # dataset would be publicly available
    docs = []
    for name in issueFilenames:
        docs.extend(
            TextLoader(
                os.path.join(repo_path, "issues", name), encoding="utf-8"
            ).load_and_split()
        )
    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    texts = text_splitter.split_documents(docs)
    db.add_documents(texts)


def generate_index(repo_name):
    repo_path = os.path.join(data_path, "data", repo_name)

    generate_project_structure_description(repo_path)
    embeddings = OpenAIEmbeddings(disallowed_special=())
    docs = []
    docs.extend(
        TextLoader(
            os.path.join(repo_path, "project-structure.txt"), encoding="utf-8"
        ).load_and_split()
    )
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "repo")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                docs.extend(loader.load_and_split())
            except Exception as e:
                pass

    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    texts = text_splitter.split_documents(docs)

    db = DeepLake(
        dataset_path=os.path.join(repo_path, "vector_store"),
        embedding_function=embeddings,
        overwrite=True,
    )  # dataset would be publicly available
    db.add_documents(texts)

    print("done")


if __name__ == "__main__":
    generate_index(sys.argv[1])
