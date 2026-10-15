from collections.abc import Iterable

from app.providers.base import IntegrationProvider
from app.providers.google.gmail.provider import GoogleGmailProvider


class ProviderNotRegisteredError(LookupError):
    """Raised when no adapter is registered for a provider and resource type."""


class ProviderRegistry:
    def __init__(
        self,
        providers: Iterable[IntegrationProvider] = (),
    ) -> None:
        self._providers: dict[tuple[str, str], IntegrationProvider] = {}

        for provider in providers:
            self.register(provider)

    def register(self, provider: IntegrationProvider) -> None:
        key = self._key(provider.provider, provider.integration_type)

        if key in self._providers:
            raise ValueError(
                "A provider is already registered for "
                f"{key[0]}/{key[1]}."
            )

        self._providers[key] = provider

    def get(
        self,
        *,
        provider: str,
        integration_type: str,
    ) -> IntegrationProvider:
        key = self._key(provider, integration_type)

        try:
            return self._providers[key]
        except KeyError as exc:
            raise ProviderNotRegisteredError(
                f"No integration provider is registered for "
                f"{key[0]}/{key[1]}."
            ) from exc

    @staticmethod
    def _key(provider: str, integration_type: str) -> tuple[str, str]:
        normalized_provider = provider.strip().lower()
        normalized_type = integration_type.strip().lower()

        if not normalized_provider or not normalized_type:
            raise ValueError("Provider and integration type are required.")

        return normalized_provider, normalized_type


provider_registry = ProviderRegistry(
    providers=(GoogleGmailProvider(),),
)