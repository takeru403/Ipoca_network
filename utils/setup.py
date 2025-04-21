from setuptools import setup, find_packages

setup(
    name="utils",
    version="0.1.0",
    packages=find_packages(where="src"),
    package_dir={"": "src"},
    install_requires=[],  # 他に依存があればここに書く
)
