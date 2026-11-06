FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY gradle gradle
COPY gradlew build.gradle settings.gradle ./
RUN chmod +x gradlew
COPY src src
COPY mobile/assets/brand-logo.png mobile/assets/brand-logo.png
RUN ./gradlew bootJar --no-daemon
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S toyapp && adduser -S toyapp -G toyapp
RUN mkdir -p /app/logs && chown toyapp:toyapp /app/logs
COPY --from=build /app/build/libs/*-SNAPSHOT.jar app.jar
USER toyapp
EXPOSE 8090
ENTRYPOINT ["java", "-jar", "app.jar"]
