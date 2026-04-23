import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './DTOs/CreateUser.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
    constructor(private readonly usersRepository: UsersRepository) {}

    createUser(createUserRequest: CreateUserDto) {
        return this.usersRepository.create(createUserRequest);
    }

    findAll() {
        return this.usersRepository.findAll();
    }
}
