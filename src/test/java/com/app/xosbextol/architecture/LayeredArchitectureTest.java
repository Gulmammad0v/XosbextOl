package com.app.xosbextol.architecture;

import com.tngtech.archunit.core.importer.ClassFileImporter;
import com.tngtech.archunit.core.importer.ImportOption;
import org.junit.jupiter.api.Test;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

class LayeredArchitectureTest {
    private final com.tngtech.archunit.core.domain.JavaClasses classes = new ClassFileImporter()
        .withImportOption(ImportOption.Predefined.DO_NOT_INCLUDE_TESTS)
        .importPackages("com.app.xosbextol");

    @Test
    void controllersDoNotAccessPersistenceOrExternalClientsDirectly() {
        noClasses().that().resideInAPackage("..controller..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "..repository..", "..client..", "..scheduler..", "..service.rabbit..")
            .check(classes);
    }

    @Test
    void modelsRemainIndependentFromApplicationLayers() {
        noClasses().that().resideInAPackage("..model..")
            .should().dependOnClassesThat().resideInAnyPackage(
                "..controller..", "..service.impl..", "..repository..", "..client..")
            .check(classes);
    }

    @Test
    void repositoriesAreUsedOnlyByServiceImplementationsAndInfrastructure() {
        noClasses().that().resideOutsideOfPackages(
                "..service.impl..", "..repository..", "..config..")
            .should().dependOnClassesThat().resideInAPackage("..repository..")
            .check(classes);
    }
}
