import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './DTOs/users.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
    constructor(private readonly usersRepository: UsersRepository) {}

    createUser(createUserRequest: CreateUserDto) {
        return this.usersRepository.create({name: createUserRequest.name, phone: createUserRequest.phone})
    }
}
