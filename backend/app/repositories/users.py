from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models.users import User
from app.schemas.user import UserCreate


class UserRepository:
    def get_by_id(self, db: Session, user_id: int) -> User | None:
        return db.get(User, user_id)

    def get_by_email(self, db: Session, email: str) -> User | None:
        stmt = select(User).where(User.email == email)
        return db.scalars(stmt).first()


    def create_verified_user(
        self,
        db: Session,
        *,
        email: str,
        password_hash: str,
        first_name: str | None,
        last_name: str | None,
        ) -> User:
            user = User(
                email=email,
                password_hash=password_hash,
                first_name=first_name,
                last_name=last_name,
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            return user


user_repo = UserRepository()