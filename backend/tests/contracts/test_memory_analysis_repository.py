import pytest

from backend.app.persistence.memory.analyses import InMemoryAnalysisRepository
from backend.tests.contracts.analysis_repository import AnalysisRepositoryContract


@pytest.fixture
def analysis_repository():
    return InMemoryAnalysisRepository()


class TestInMemoryAnalysisRepository(AnalysisRepositoryContract):
    pass
