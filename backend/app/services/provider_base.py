from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class DataProvider(ABC):
    """
    Abstract base class for train data providers.
    """
    
    @abstractmethod
    def get_live_status(self, train_number: str) -> Optional[Dict[str, Any]]:
        """
        Fetch the current live status for a train.
        Must return normalized data or None if unavailable/error.
        """
        pass
