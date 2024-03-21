import os
import time
import sys
import meta_information
from langchain.document_loaders import TextLoader, ConcurrentLoader
from langchain.embeddings.openai import OpenAIEmbeddings
from langchain.vectorstores import FAISS

# from langchain.text_splitter import CharacterTextSplitter
from langchain.text_splitter import RecursiveCharacterTextSplitter, Language
from langchain.document_loaders.generic import GenericLoader
from langchain.document_loaders.parsers import LanguageParser
from langchain.document_loaders.parsers.generic import MimeTypeBasedParser
from dotenv import load_dotenv

from langchain.document_loaders.blob_loaders.schema import Blob

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))


data_path = os.getenv("DATA_PATH")


class FileEndingParser(BaseBlobParser):
    def __init__(
        self,
        handlers: Mapping[str, BaseBlobParser] = {
            "py": LanguageParser(language=Language.PYTHON, parser_threshold=500),
            "js": LanguageParser(language=Language.JAVASCRIPT, parser_threshold=500),
            "ts": LanguageParser(language=Language.GO, parser_threshold=500),
            "html": LanguageParser(language=Language.HTML, parser_threshold=500),
            "css": LanguageParser(language=Language.CSS, parser_threshold=500),
            "md": LanguageParser(language=Language.MARKDOWN, parser_threshold=500),
        },
        *,
        fallback_parser: Optional[BaseBlobParser] = None,
    ) -> None:
        """Define a parser that uses mime-types to determine how to parse a blob.

        Args:
            handlers: A mapping from mime-types to functions that take a blob, parse it
                      and return a document.
            fallback_parser: A fallback_parser parser to use if the mime-type is not
                             found in the handlers. If provided, this parser will be
                             used to parse blobs with all mime-types not found in
                             the handlers.
                             If not provided, a ValueError will be raised if the
                             mime-type is not found in the handlers.
        """
        self.handlers = handlers
        self.fallback_parser = fallback_parser

    def lazy_parse(self, blob: Blob) -> Iterator[Document]:
        fileExtension = blob.name.split(".")[-1]

        if fileExtension in self.handlers:
            handler = self.handlers[fileExtension]
            yield from handler.lazy_parse(blob)
        else:
            if self.fallback_parser is not None:
                yield from self.fallback_parser.lazy_parse(blob)
            else:
                raise ValueError(f"Unsupported mime type: {mimetype}")


def generate_index(repo_id: int):
    repo_path = os.path.join(data_path, str(repo_id))

    embeddings = OpenAIEmbeddings(disallowed_special=())
    docs = []

    # index repo
    ignore_list = [
        ".git",
        ".github",
        ".vscode",
        ".idea",
        ".gitignore",
    ]  # TODO: add ignore list
    # for dirpath, _, filenames in os.walk(os.path.join(repo_path, "repo")):
    #     for file in filenames:
    #         if file in ignore_list:
    #             continue
    #         try:
    #             docs.extend(_load_file(file))
    #         except Exception as e:
    #             pass
    loader = ConcurrentLoader.from_filesystem(
        repo_path,
        exclude=ignore_list,
        show_progress=True,
        parser=FileEndingParser(fallback_parser=TextParser()),
    )
    docs.extend(loader.load_and_split())

    # index file structure
    # meta_information.generate_file_structure_description(repo_path)
    # docs.extend(
    #     TextLoader(
    #         os.path.join(repo_path, "file-structure.txt"), encoding="utf-8"
    #     ).load_and_split()
    # )

    # index issues
    md_splitter = RecursiveCharacterTextSplitter.from_language(
        language=Language.MARKDOWN, chunk_size=60, chunk_overlap=0
    )
    for dirpath, _, filenames in os.walk(os.path.join(repo_path, "issues")):
        for file in filenames:
            try:
                loader = TextLoader(os.path.join(dirpath, file), encoding="utf-8")
                md_docs = loader.load_and_split(md_splitter)
                # TODO: add issue number any type=issue to docs metadata
                docs.extend(md_docs)
            except Exception as e:
                pass

    text_splitter = CharacterTextSplitter(chunk_size=1000, chunk_overlap=0)
    docs = text_splitter.split(docs)

    db = FAISS.from_documents(docs, embeddings, wait_time=30, batch_size=10)
    db.save_local(os.path.join(repo_path, "vector_store"))

    print("done")


if __name__ == "__main__":
    generate_index(sys.argv[1])
