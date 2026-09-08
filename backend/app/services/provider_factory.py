from app.config import settings
from app.services.provider_base import DataProvider
from app.services.railradar_provider import RailRadarProvider
from app.services.simulated_provider import SimulatedProvider

def get_provider() -> DataProvider:
    """
    Factory function to get the currently configured Train Data Provider.
    """
    if settings.TRAIN_DATA_PROVIDER == "RAILRADAR":
        return RailRadarProvider()
    return SimulatedProvider()
