using AutoMapper;
using SemFre.Dtos;
using SemFre.Models;

namespace SemFre.Profiles;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<User, UserDto>();
        // UserSummaryDto is embedded everywhere a user appears in another
        // DTO (search results, group members, connections, ...) - Phone/
        // Instagram must NEVER be added to it, or contact info would leak to
        // people the caller isn't connected to. Only UserProfileDto (built
        // by hand in UsersController.GetProfile, gated on AreConnectedAsync)
        // ever carries them.
        CreateMap<User, UserSummaryDto>();
        CreateMap<UserRegisterDto, User>();

        CreateMap<UserDevice, DeviceDto>();
        CreateMap<DeviceCreateDto, UserDevice>();

        CreateMap<FreeTime, FreeTimeDto>();
        CreateMap<FreeTimeCreateDto, FreeTime>();

        // FriendDto/FriendRequestDto/FreeConnectionDto are intentionally NOT mapped
        // here - each involves a "pick the other side" conditional or a GroupBy
        // aggregate that ProjectTo can't express cleanly. They're hand-built
        // .Select(...) projections in their controllers so the generated SQL
        // stays a single, reviewable statement.
    }
}
