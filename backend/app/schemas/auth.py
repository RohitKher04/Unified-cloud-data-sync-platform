from pydantic import BaseModel, EmailStr, Field


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int  


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str
    


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")
    

class RegistrationPendingResponse(BaseModel):
    message: str

class ResendEmailOTPRequest(BaseModel):
    email: EmailStr