from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: str | None = Field(default=None, max_length=40)
    amount: str | None = Field(default=None, max_length=40)
    unit: str | None = Field(default=None, max_length=40)
    section: str | None = Field(default=None, max_length=60)
    isOptional: bool = False


class Recipe(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1200)
    ingredients: list[Ingredient] = Field(min_length=2, max_length=80)
    instructions: list[str] = Field(min_length=1, max_length=60)
    prepTime: int | None = Field(default=None, ge=0, le=6000)
    cookTime: int | None = Field(default=None, ge=0, le=6000)
    totalTime: int | None = Field(default=None, ge=0, le=6000)
    servings: int | None = Field(default=None, ge=1, le=100)
    calories: int | None = Field(default=None, ge=0, le=10000)
    difficulty: str | None = Field(default=None, max_length=40)
    cuisine: str | None = Field(default=None, max_length=80)
    dietaryTags: list[str] = Field(default_factory=list, max_length=20)
    tips: list[str] = Field(default_factory=list, max_length=12)


class RecipeRequest(BaseModel):
    request: str | None = Field(default=None, min_length=3, max_length=2000)
    ingredients: list[str] = Field(default_factory=list, max_length=50)
    cuisine: str | None = Field(default=None, max_length=80)
    dietaryRestrictions: list[str] = Field(default_factory=list, max_length=20)
    cookingTime: int | None = Field(default=None, ge=5, le=600)
    servings: int | None = Field(default=None, ge=1, le=100)
    difficulty: str | None = Field(default=None, max_length=40)
    budget: float | None = Field(default=None, ge=0, le=10000)


class GenerateEnvelope(BaseModel):
    model: str = "savry-recipe-v1"
    task: str = "recipe.generate"
    input: RecipeRequest
    response_schema: dict | None = None

