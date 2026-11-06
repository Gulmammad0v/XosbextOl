package com.app.xosbextol.venue;
import com.app.xosbextol.service.impl.MediaService;
import com.app.xosbextol.service.impl.AuditService;
import com.app.xosbextol.service.VenueAccess;
import com.app.xosbextol.repository.cache.VenueCache;
import com.app.xosbextol.repository.*;
import com.app.xosbextol.model.entity.VenueMedia;
import com.app.xosbextol.handler.customExceptions.BusinessException;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsRequest;
import software.amazon.awssdk.services.s3.model.DeleteObjectsResponse;
import software.amazon.awssdk.core.sync.RequestBody;
import org.springframework.test.util.ReflectionTestUtils;
import org.junit.jupiter.api.Test;
import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class MediaServiceTest {
    @Test void rejectsEleventhVenueImageBeforeWritingStorage() {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        when(mediaRepo.countByVenue_IdAndHallIsNullAndType(1,"IMAGE")).thenReturn(10L);
        var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,mock(AuditService.class));
        var error=assertThrows(BusinessException.class,()->service.upload(1,1,null,new byte[]{1}));
        assertEquals("BUSINESS_CONFLICT",error.code());
        verifyNoInteractions(s3);
    }

    @Test void rejectsNonImageBeforeWritingStorage() {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,mock(AuditService.class));
        assertThrows(BusinessException.class,()->service.upload(1,1,null,"not an image".getBytes()));
        verifyNoInteractions(s3);
    }
    @Test void createsThreeJpegSizesFromPng() throws Exception {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,mock(AuditService.class));
        ReflectionTestUtils.setField(service,"bucket","test");ReflectionTestUtils.setField(service,"cdn","https://cdn.example.com");
        doAnswer(invocation->{ VenueMedia value=invocation.getArgument(0);ReflectionTestUtils.setField(value,"id",1L);return value; }).when(mediaRepo).saveAndFlush(any(VenueMedia.class));
        var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(800,600,BufferedImage.TYPE_INT_RGB),"png",out);
        var result=service.upload(1,1,null,out.toByteArray());
        assertTrue(result.get("thumbUrl").toString().endsWith("-thumb.jpg"));
        verify(s3,times(3)).putObject(any(PutObjectRequest.class),any(RequestBody.class));
        var stored=org.mockito.ArgumentCaptor.forClass(VenueMedia.class);verify(mediaRepo).saveAndFlush(stored.capture());
        assertTrue(stored.getValue().getStorageKey().endsWith("-full.jpg"));
        verify(cache).changed(1);
    }
    @Test void uploadsLegalDocumentWithoutAddingItToGallery() throws Exception {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,mock(AuditService.class));
        ReflectionTestUtils.setField(service,"bucket","test");ReflectionTestUtils.setField(service,"cdn","https://cdn.example.com");
        var out=new ByteArrayOutputStream();ImageIO.write(new BufferedImage(800,600,BufferedImage.TYPE_INT_RGB),"png",out);
        var result=service.uploadDocument(1,1,"COMPANY",out.toByteArray());
        assertTrue(result.get("url").toString().endsWith("-full.jpg"));
        verify(s3).putObject(any(PutObjectRequest.class),any(RequestBody.class));
        verifyNoInteractions(mediaRepo);
    }

    @Test void deletesAllThreeManagedImageVariants() {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        var audit=mock(AuditService.class);var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,audit);
        ReflectionTestUtils.setField(service,"bucket","test");ReflectionTestUtils.setField(service,"cdn","https://cdn.example.com");
        var value=new VenueMedia();ReflectionTestUtils.setField(value,"id",7L);value.setStorageKey("venues/1/123e4567-e89b-12d3-a456-426614174000-full.jpg");
        when(mediaRepo.findByIdAndVenue_Id(7,1)).thenReturn(java.util.Optional.of(value));
        when(s3.deleteObjects(any(DeleteObjectsRequest.class))).thenReturn(DeleteObjectsResponse.builder().build());

        service.delete(2,1,7);

        var request=org.mockito.ArgumentCaptor.forClass(DeleteObjectsRequest.class);
        verify(s3).deleteObjects(request.capture());
        assertEquals(3,request.getValue().delete().objects().size());
        assertEquals(java.util.Set.of(
                "venues/1/123e4567-e89b-12d3-a456-426614174000-full.jpg",
                "venues/1/123e4567-e89b-12d3-a456-426614174000-medium.jpg",
                "venues/1/123e4567-e89b-12d3-a456-426614174000-thumb.jpg"),
                request.getValue().delete().objects().stream().map(item->item.key()).collect(java.util.stream.Collectors.toSet()));
        verify(mediaRepo).delete(value);verify(mediaRepo).flush();verify(cache).changed(1);verify(audit).record(2L,"VENUE_MEDIA_DELETED","VENUE_MEDIA",7L);
    }

    @Test void doesNotDeleteExternalUrlFromStorage() {
        var s3=mock(S3Client.class);var venues=mock(VenueAccess.class);var venueRepo=mock(VenueRepository.class);var hallRepo=mock(HallRepository.class);var mediaRepo=mock(VenueMediaRepository.class);var cache=mock(VenueCache.class);
        var service=new MediaService(s3,venues,venueRepo,hallRepo,mediaRepo,cache,mock(AuditService.class));
        ReflectionTestUtils.setField(service,"cdn","https://cdn.example.com");
        var value=new VenueMedia();value.setUrl("https://example.com/photo.jpg");
        when(mediaRepo.findByIdAndVenue_Id(7,1)).thenReturn(java.util.Optional.of(value));

        service.delete(2,1,7);

        verifyNoInteractions(s3);
        verify(mediaRepo).delete(value);verify(mediaRepo).flush();
    }
}
